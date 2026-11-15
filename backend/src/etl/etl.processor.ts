import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger, type BeforeApplicationShutdown } from '@nestjs/common';
import { Readable } from 'node:stream';
import { CatalogImportService } from './catalog-import.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CARGA_LOCAL_RETIRADA, PipelinesService } from './pipelines.service.js';
import { CATALOG_TARGETS } from './dto/pipeline.dto.js';
import { openCsvSource } from './http-source.js';

@Processor('etl-queue', { concurrency: 1 })
export class EtlProcessor
  extends WorkerHost
  implements BeforeApplicationShutdown
{
  private readonly logger = new Logger(EtlProcessor.name);
  constructor(
    private readonly catalogImport: CatalogImportService,
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
  ) {
    super();
  }

  async beforeApplicationShutdown() {
    await this.worker.close();
  }

  async process(
    job: Job<{ jobId: string; dataset: string; pipelineId?: string }>,
  ) {
    if (job.name === 'scheduled-pipeline') {
      if (!job.data.pipelineId) throw new Error('Pipeline obligatorio');
      return this.pipelines.run(job.data.pipelineId, undefined, true);
    }
    const { jobId: ejecucionId } = job.data;
    const record = await this.prisma.models.EjecucionEtl.firstOrThrow({
      id: ejecucionId,
    });
    if (!record.instantaneaConfiguracion) {
      await this.pipelines.cerrarCargaLocal(record);
      throw new UnrecoverableError(CARGA_LOCAL_RETIRADA);
    }
    const dataset = CATALOG_TARGETS.find((target) => target === record.fuente);
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
      if (!dataset) throw new Error('Dataset no soportado');
      const config = await this.pipelines.validateConfiguration(
        dataset,
        record.instantaneaConfiguracion,
      );
      const fuente = Readable.from(
        (async function* () {
          yield* await openCsvSource(
            config.conexion,
            config.configuracionProgramacion.tiempoLimiteSegundos,
          );
        })(),
      );
      const {
        processed: filasProcesadas,
        inserted: filasInsertadas,
        discarded: filasDescartadas,
      } = await this.catalogImport.importCatalog(
        dataset,
        fuente,
        ejecucionId,
        config,
      );
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento,
        nivel: 'info',
        mensaje: `${dataset}: ${filasProcesadas} procesadas, ${filasInsertadas} nuevas, ${filasDescartadas} descartadas`,
      });
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
