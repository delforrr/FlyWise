import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { resolve } from 'node:path';
import { EtlService } from './etl.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PipelinesService } from './pipelines.service.js';
import { ETL_DATASETS } from './dto/trigger-etl.dto.js';
import { OPENFLIGHTS_FILES, type CatalogDataset } from './catalog.js';

@Processor('etl-queue', { concurrency: 1 })
export class EtlProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlProcessor.name);
  constructor(
    private readonly etlService: EtlService,
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
  ) {
    super();
  }

  async process(
    job: Job<{ jobId: string; dataset: string; pipelineId?: string }>,
  ) {
    if (job.name === 'scheduled-pipeline') {
      if (!job.data.pipelineId) throw new Error('Pipeline obligatorio');
      return this.pipelines.run(job.data.pipelineId, undefined, true);
    }
    const { jobId: ejecucionId, dataset: conjunto } = job.data;
    const nombres: Record<string, string> = {
      countries: 'paises',
      airports: 'aeropuertos',
      airlines: 'aerolineas',
      routes: 'rutas',
    };
    const dataset = nombres[conjunto] ?? conjunto;
    const intento = job.attemptsStarted || job.attemptsMade + 1;
    const now = () =>
      new Date().toISOString().replace('T', ' ').replace('Z', '');
    await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
      estado: 'running',
      intento,
      iniciadoEn: now(),
      finalizadoEn: null,
      mensajeError: null,
      checksumFuente: null,
      filasTotales: 0,
      filasProcesadas: 0,
      filasInsertadas: 0,
      filasDescartadas: 0,
    });
    await this.prisma.models.EventoEjecucionEtl.create({
      ejecucionId,
      intento,
      nivel: 'info',
      mensaje: `Inicio del intento ${intento}`,
    });
    try {
      if (!ETL_DATASETS.includes(dataset))
        throw new Error('Dataset no soportado');
      const record = await this.prisma.models.EjecucionEtl.where({
        id: ejecucionId,
      }).firstOrThrow();
      const config = record.instantaneaConfiguracion
        ? await this.pipelines.validateConfiguration(
            dataset,
            record.instantaneaConfiguracion,
          )
        : null;
      let filasProcesadas = 0,
        filasInsertadas = 0,
        filasDescartadas = 0;
      const datasets: CatalogDataset[] =
        dataset === 'all'
          ? ['paises', 'aeropuertos', 'aerolineas', 'rutas']
          : [dataset as CatalogDataset];
      for (const target of datasets) {
        const result = await this.etlService.importCatalog(
          target,
          config
            ? null
            : resolve(process.cwd(), 'data', OPENFLIGHTS_FILES[target]),
          ejecucionId,
          config ?? undefined,
        );
        filasProcesadas += result.processed;
        filasInsertadas += result.inserted;
        filasDescartadas += result.discarded;
        await this.prisma.models.EventoEjecucionEtl.create({
          ejecucionId,
          intento,
          nivel: 'info',
          mensaje: `${target}: ${result.processed} procesadas, ${result.inserted} nuevas, ${result.discarded} descartadas`,
        });
      }
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        estado: 'completed',
        finalizadoEn: now(),
      });
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento,
        nivel: 'success',
        mensaje: 'Ingesta completada',
      });
      return {
        success: true,
        filasProcesadas,
        filasInsertadas,
        filasDescartadas,
      };
    } catch {
      const mensaje =
        'Falló la lectura o persistencia del catálogo; el reintento es idempotente';
      this.logger.error(`${ejecucionId}: ${mensaje}`);
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        estado: 'failed',
        finalizadoEn: now(),
        mensajeError: mensaje,
      });
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento,
        nivel: 'error',
        mensaje,
      });
      throw new Error(mensaje);
    }
  }
}
