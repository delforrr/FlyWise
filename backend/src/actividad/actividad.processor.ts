import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActividadService, type SnapshotAnac } from './actividad.service.js';

@Processor('actividad-queue', { concurrency: 1 })
export class ActividadProcessor extends WorkerHost {
  constructor(
    private readonly service: ActividadService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }
  async process(job: Job<{ ejecucionId: string }>) {
    if (job.name === 'anac-mensual') {
      const now = new Date();
      const periodo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      )
        .toISOString()
        .slice(0, 7);
      return this.service.ejecutar(periodo, undefined, true);
    }
    const id = job.data.ejecucionId;
    const record = await this.prisma.models.EjecucionEtl.firstOrThrow({
      id,
      fuente: 'ANAC',
    });
    if (record.estado === 'completed') return;
    const intento = job.attemptsStarted || job.attemptsMade + 1;
    const now = () =>
      new Date().toISOString().replace('T', ' ').replace('Z', '');
    const snapshot = record.instantaneaConfiguracion as unknown as SnapshotAnac;
    await this.prisma.models.EjecucionEtl.where({ id }).update({
      estado: 'running',
      intento,
      iniciadoEn: now(),
      finalizadoEn: null,
      mensajeError: null,
      filasTotales: 0,
      filasProcesadas: 0,
      filasInsertadas: 0,
      filasDescartadas: 0,
    });
    await this.prisma.models.EventoEjecucionEtl.create({
      ejecucionId: id,
      intento,
      nivel: 'info',
      mensaje: `ANAC ${snapshot.conexion.periodo}: inicio del intento ${intento}`,
    });
    try {
      const { fuente, uri } = await this.service.descargar(
        snapshot.conexion.fichaUrl,
      );
      return await this.service.importar(
        fuente,
        snapshot.conexion.periodo,
        id,
        uri,
      );
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Falló la ingesta ANAC';
      await this.prisma.models.EjecucionEtl.where({ id }).update({
        estado: 'failed',
        finalizadoEn: now(),
        mensajeError: mensaje,
      });
      await this.prisma.models.EventoEjecucionEtl.create({
        ejecucionId: id,
        intento,
        nivel: 'error',
        mensaje,
      });
      throw new Error(mensaje);
    }
  }
}
