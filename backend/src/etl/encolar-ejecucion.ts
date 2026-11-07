import { BadRequestException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PipelineConfiguration } from './interfaces/pipeline-configuration.js';

export async function encolarEjecucion(
  prisma: PrismaService,
  queue: Queue,
  datos: {
    fuente: string;
    procesoId?: string;
    solicitanteId?: string;
    instantaneaConfiguracion?: PipelineConfiguration;
  },
) {
  const config = datos.instantaneaConfiguracion;
  const record = await prisma.models.EjecucionEtl.create({
    ...datos,
    estado: 'pending',
    uriFuente: config?.conexion.urlEndpoint ?? null,
  });
  try {
    const job = await queue.add(
      'process-dataset',
      { jobId: record.id, dataset: datos.fuente },
      {
        jobId: record.id,
        attempts: (config?.configuracionProgramacion.maximoReintentos ?? 2) + 1,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    );
    return { ejecucionId: record.id, bullJobId: job.id };
  } catch {
    const mensaje = 'No fue posible encolar la ejecución';
    await prisma.models.EjecucionEtl.where({ id: record.id }).update({
      estado: 'failed',
      mensajeError: mensaje,
    });
    throw new BadRequestException(mensaje);
  }
}
