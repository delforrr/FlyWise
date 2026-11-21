import { BtsService } from '../bts/bts.service.js';
import { OagService } from '../adapters/oag/oag.service.js';
import type { CargasVuelos } from '../ingestion/application/carga-vuelos.js';
import {
  CARGAS_VUELOS,
  CargasVuelosController,
} from './cargas-vuelos.controller.js';
import { OagModule } from '../adapters/oag/oag.module.js';
import { BtsModule } from '../bts/bts.module.js';
import { ServiciosOperacionesService } from './servicios-operaciones.service.js';
import { CatalogImportService } from './catalog-import.service.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EtlProcessor } from './etl.processor.js';
import { PipelinesService } from './pipelines.service.js';
import { PipelineController } from './pipeline.controller.js';
import { EtlHistoryController } from './etl-history.controller.js';
import { CatalogIdentitiesController } from './catalog-identities.controller.js';

@Module({
  imports: [
    OagModule,
    BtsModule,
    BullModule.registerQueue({
      name: 'etl-queue',
    }),
  ],
  controllers: [
    EtlHistoryController,
    PipelineController,
    CatalogIdentitiesController,
    CargasVuelosController,
  ],
  providers: [
    CatalogImportService,
    EtlProcessor,
    PipelinesService,
    ServiciosOperacionesService,
    {
      provide: CARGAS_VUELOS,
      inject: [OagService, BtsService],
      useFactory: (
        porTramo: OagService,
        mensual: BtsService,
      ): CargasVuelos => ({
        coberturaMensual: 'Vuelos domésticos de Estados Unidos',
        mensual: ({ periodo }, actor) => mensual.ejecutar(periodo, actor, true),
        tramo: (consulta, actor) => porTramo.ejecutarTramo(consulta, actor),
      }),
    },
  ],
})
export class EtlModule {}
