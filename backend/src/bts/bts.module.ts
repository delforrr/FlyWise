import { ADAPTADOR_BTS, AdaptadorBts } from '../adapters/bts/adaptador-bts.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BtsController } from './bts.controller.js';
import { BtsService } from './bts.service.js';
import { BtsProcessor } from './bts.processor.js';
import { VuelosModule } from '../vuelos/vuelos.module.js';

@Module({
  imports: [VuelosModule, BullModule.registerQueue({ name: 'bts-queue' })],
  exports: [BtsService],
  controllers: [BtsController],
  providers: [
    { provide: ADAPTADOR_BTS, useClass: AdaptadorBts },
    BtsService,
    BtsProcessor,
  ],
})
export class BtsModule {}
