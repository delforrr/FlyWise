import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EurocontrolService } from './eurocontrol.service.js';
import { EurocontrolProcessor } from './eurocontrol.processor.js';
import { IndicadoresController } from './indicadores.controller.js';
@Module({
  imports: [BullModule.registerQueue({ name: 'eurocontrol-queue' })],
  controllers: [IndicadoresController],
  providers: [EurocontrolService, EurocontrolProcessor],
})
export class IndicadoresModule {}
