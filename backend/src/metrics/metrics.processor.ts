import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MetricsService } from './metrics.service.js';

@Processor('metrics-queue', { concurrency: 1 })
export class MetricsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MetricsProcessor.name);
  constructor(
    private readonly metrics: MetricsService,
    @InjectQueue('metrics-queue') private readonly queue: Queue,
  ) {
    super();
  }
  async onModuleInit() {
    // Persistent pending rows are the outbox; the scheduled sweep also recovers lost notifications.
    await this.queue.upsertJobScheduler(
      'recalcular-pendientes',
      { every: 5000 },
      {
        name: 'recalcular',
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 10,
          removeOnFail: 10,
        },
      },
    );
  }
  async process() {
    try {
      return await this.metrics.recalcularPendientes();
    } catch (error) {
      this.logger.error('No se pudieron publicar las métricas');
      await this.metrics.registrarError(error);
      throw error;
    }
  }
}
