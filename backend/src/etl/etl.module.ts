import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EtlService } from './etl.service.js';
import { EtlProcessor } from './etl.processor.js';
import { PipelinesService } from './pipelines.service.js';
import { PipelineController } from './pipeline.controller.js';
import { EtlController } from './etl.controller.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'etl-queue',
    }),
  ],
  controllers: [EtlController, PipelineController],
  providers: [EtlService, EtlProcessor, PipelinesService],
  exports: [EtlService],
})
export class EtlModule {}
