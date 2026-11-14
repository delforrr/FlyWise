import { Module } from '@nestjs/common';
import { VuelosService } from './vuelos.service.js';
import { VuelosController } from './vuelos.controller.js';
@Module({
  providers: [VuelosService],
  controllers: [VuelosController],
  exports: [VuelosService],
})
export class VuelosModule {}
