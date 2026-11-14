import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { timestampToDate } from '../prisma/timestamp.js';
import { ETL_DATASETS } from './dto/trigger-etl.dto.js';
import { encolarEjecucion } from './encolar-ejecucion.js';

@Injectable()
export class EtlService {
  constructor(
    @InjectQueue('etl-queue') private readonly etlQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async triggerJob(dataset: string) {
    if (!ETL_DATASETS.includes(dataset)) {
      throw new BadRequestException('Dataset no soportado');
    }
    const job = await encolarEjecucion(this.prisma, this.etlQueue, {
      fuente: dataset,
    });
    return { message: `Job ${dataset} encolado exitosamente`, ...job };
  }

  async getStatus() {
    const [waiting, activa, completed, failed] = await Promise.all([
      this.etlQueue.getWaitingCount(),
      this.etlQueue.getActiveCount(),
      this.etlQueue.getCompletedCount(),
      this.etlQueue.getFailedCount(),
    ]);

    return {
      queue: 'etl-queue',
      counts: {
        waiting,
        activa,
        completed,
        failed,
      },
    };
  }

  async getHistory() {
    const ejecuciones = await this.prisma.models.EjecucionEtl.orderBy((job) =>
      job.iniciadoEn.desc(),
    )
      .limit(20)
      .all();
    return ejecuciones.map((job) => {
      const iniciadoEn = job.iniciadoEn
        ? timestampToDate(job.iniciadoEn)
        : null;
      const finalizadoEn = job.finalizadoEn
        ? timestampToDate(job.finalizadoEn)
        : null;
      return {
        ...job,
        iniciadoEn,
        finalizadoEn,
        durationMs:
          iniciadoEn && finalizadoEn
            ? finalizadoEn.getTime() - iniciadoEn.getTime()
            : null,
      };
    });
  }
}
