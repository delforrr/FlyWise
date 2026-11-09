import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsService } from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsProcessor } from './metrics.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'metrics-queue' })],
  providers: [MetricsService, MetricsProcessor],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
