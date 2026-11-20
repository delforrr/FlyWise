import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { BtsService } from './bts.service.js';

@Processor('bts-queue', { concurrency: 1 })
export class BtsProcessor extends WorkerHost {
  constructor(private readonly bts: BtsService) {
    super();
  }
  async process(job: Job<{ ejecucionId?: string; periodo?: string }>) {
    if (job.name === 'recuperar') return this.bts.recuperar();
    if (job.name === 'programada') {
      if ((await this.bts.configuracion()).pausado) return;
      try {
        return await this.bts.ejecutar();
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        new Logger(BtsProcessor.name).warn(error.getResponse());
        return;
      }
    }
    if (!job.data.ejecucionId || !job.data.periodo)
      throw new Error('Falta ejecución o mes BTS');
    const quedanIntentos = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    return this.bts.importar(
      job.data.ejecucionId,
      job.data.periodo,
      undefined,
      quedanIntentos,
    );
  }
}
