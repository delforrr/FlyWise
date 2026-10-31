import { AdministracionRutasController } from './administracion-rutas.controller.js';
import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service.js';
import { RoutesController } from './routes.controller.js';

@Module({
  controllers: [RoutesController, AdministracionRutasController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
