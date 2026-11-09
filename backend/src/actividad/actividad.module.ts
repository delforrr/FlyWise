import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ActividadController } from './actividad.controller.js';
import { ActividadService } from './actividad.service.js';
import { ActividadProcessor } from './actividad.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'actividad-queue' })],
  controllers: [ActividadController],
  providers: [ActividadService, ActividadProcessor],
})
export class ActividadModule {}
