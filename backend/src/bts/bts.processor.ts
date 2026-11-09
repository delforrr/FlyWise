import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job } from 'bullmq';
import { BtsService } from './bts.service.js';

@Processor('bts-queue', { concurrency: 1 })
export class BtsProcessor extends WorkerHost {
  constructor(private readonly bts: BtsService) {
    super();
  }
  async process(job: Job<{ ejecucionId?: string; periodo?: string }>) {
    if (job.name === 'programada') {
      if ((await this.bts.configuracion()).pausado) return;
      return this.bts.ejecutar();
    }
    if (!job.data.ejecucionId || !job.data.periodo)
      throw new Error('Falta ejecución o mes BTS');
    return this.bts.importar(job.data.ejecucionId, job.data.periodo);
  }
}
