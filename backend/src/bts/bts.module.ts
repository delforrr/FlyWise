import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BtsController } from './bts.controller.js';
import { BtsService } from './bts.service.js';
import { BtsProcessor } from './bts.processor.js';
import { VuelosModule } from '../vuelos/vuelos.module.js';

@Module({
  imports: [VuelosModule, BullModule.registerQueue({ name: 'bts-queue' })],
  controllers: [BtsController],
  providers: [BtsService, BtsProcessor],
})
export class BtsModule {}
