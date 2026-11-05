import { AdministracionAerolineasController } from './administracion-aerolineas.controller.js';
import { Module } from '@nestjs/common';
import { AirlinesService } from './airlines.service.js';
import { AirlinesController } from './airlines.controller.js';

@Module({
  controllers: [AirlinesController, AdministracionAerolineasController],
  providers: [AirlinesService],
  exports: [AirlinesService],
})
export class AirlinesModule {}
