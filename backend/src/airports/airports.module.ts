import { AdministracionAeropuertosController } from './administracion-aeropuertos.controller.js';
import { Module } from '@nestjs/common';
import { AirportsService } from './airports.service.js';
import { AirportsController } from './airports.controller.js';

@Module({
  controllers: [AirportsController, AdministracionAeropuertosController],
  providers: [AirportsService],
  exports: [AirportsService],
})
export class AirportsModule {}
