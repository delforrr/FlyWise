import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module.js';
import { VuelosService } from './vuelos.service.js';
import { VuelosController } from './vuelos.controller.js';
@Module({
  imports: [MetricsModule],
  providers: [VuelosService],
  controllers: [VuelosController],
  exports: [VuelosService],
})
export class VuelosModule {}
