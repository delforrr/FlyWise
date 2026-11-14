import { ADAPTADOR_OAG, AdaptadorOag } from './adaptador-oag.js';
import { Module } from '@nestjs/common';
import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { MetricsModule } from '../../metrics/metrics.module.js';
import { OagController } from './oag.controller.js';
import { OAG_QUEUE, OagService } from './oag.service.js';

@Processor(OAG_QUEUE, { concurrency: 1 })
class OagProcessor extends WorkerHost {
  constructor(private readonly oag: OagService) {
    super();
  }

  process(job: Job<{ ejecucionId: string }>) {
    return this.oag.importar(job.data.ejecucionId);
  }
}

@Module({
  imports: [MetricsModule, BullModule.registerQueue({ name: OAG_QUEUE })],
  controllers: [OagController],
  providers: [
    { provide: ADAPTADOR_OAG, useClass: AdaptadorOag },
    OagService,
    OagProcessor,
  ],
})
export class OagModule {}
