import { Module } from '@nestjs/common';
import { AirportsService } from './airports.service.js';
import { AirportsController } from './airports.controller.js';

@Module({
  controllers: [AirportsController],
  providers: [AirportsService],
  exports: [AirportsService],
})
export class AirportsModule {}
