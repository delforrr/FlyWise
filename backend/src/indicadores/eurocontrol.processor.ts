import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EurocontrolService } from './eurocontrol.service.js';
import {
  EUROCONTROL_PRODUCTS,
  type EurocontrolProduct,
} from './indicadores.dto.js';
@Processor('eurocontrol-queue', { concurrency: 1 })
export class EurocontrolProcessor extends WorkerHost {
  private readonly logger = new Logger(EurocontrolProcessor.name);

  constructor(
    private readonly service: EurocontrolService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }
  async process(
    job: Job<{ producto: EurocontrolProduct; ejecucionId?: string }>,
  ) {
    const { producto, ejecucionId } = job.data;
    if (!EUROCONTROL_PRODUCTS.includes(producto))
      throw new Error('Producto EUROCONTROL desconocido');
    if (job.name === 'scheduled-eurocontrol')
      return this.service.enqueue(producto, undefined, true);
    if (!ejecucionId) throw new Error('Ejecución obligatoria');
    const existing = await this.prisma.models.EjecucionEtl.first({
      id: ejecucionId,
    });
    if (!existing || existing.fuente !== `EUROCONTROL:${producto}`)
      throw new Error('Ejecución incompatible');
    if (existing.estado === 'completed') return { completed: true };
    const intento = job.attemptsStarted || job.attemptsMade + 1;
    const now = () =>
      new Date().toISOString().replace('T', ' ').replace('Z', '');
    await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
      estado: 'running',
      iniciadoEn: now(),
      finalizadoEn: null,
      intento,
      mensajeError: null,
      filasTotales: 0,
      filasProcesadas: 0,
      filasInsertadas: 0,
      filasDescartadas: 0,
    });
    await this.prisma.models.EventoEjecucionEtl.create({
      ejecucionId,
      intento,
      nivel: 'info',
      mensaje: `Inicio EUROCONTROL ${producto}; intento ${intento}`,
    });
    let source: Awaited<ReturnType<EurocontrolService['download']>> | undefined;
    try {
      source = await this.service.download(producto);
      return await this.service.importWorkbook(
        producto,
        source.path,
        ejecucionId,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Falló EUROCONTROL';
      await this.prisma.models.EjecucionEtl.where({ id: ejecucionId }).update({
        estado: 'failed',
        finalizadoEn: now(),
        mensajeError: message,
      });
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId,
        intento,
        nivel: 'error',
        mensaje: `No se publicó la cobertura parcial: ${message}`,
      });
      throw new Error(message);
    } finally {
      await source?.cleanup().catch(() => {
        this.logger.warn(`No se pudo limpiar el temporal de ${ejecucionId}`);
      });
    }
  }
}
