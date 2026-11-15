import { CatalogImportService } from './catalog-import.service.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EtlProcessor } from './etl.processor.js';
import { PipelinesService } from './pipelines.service.js';
import { PipelineController } from './pipeline.controller.js';
import { EtlHistoryController } from './etl-history.controller.js';
import { CatalogIdentitiesController } from './catalog-identities.controller.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'etl-queue',
    }),
  ],
  controllers: [
    EtlHistoryController,
    PipelineController,
    CatalogIdentitiesController,
  ],
  providers: [CatalogImportService, EtlProcessor, PipelinesService],
})
export class EtlModule {}
