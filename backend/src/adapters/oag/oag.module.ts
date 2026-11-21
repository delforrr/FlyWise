import { ConfiguracionOag } from './configuracion-oag.js';
import { ADAPTADOR_OAG, AdaptadorOag } from './adaptador-oag.js';
import { ConflictException, Logger, Module } from '@nestjs/common';
import { BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, type Job } from 'bullmq';
import type { AdaptadorOperaciones } from '../../ingestion/application/adaptador-operaciones.js';
import type {
  CursorOag,
  LecturaOag,
  OperacionOag,
} from '../../ingestion/application/oag/alcance-oag.js';
import { CargarOag } from '../../ingestion/application/oag/cargar-oag.js';
import { OagController } from './oag.controller.js';
import { OagService } from './oag.service.js';
import { demoraReintentoOag, OAG_QUEUE, type TrabajoOag } from './cola-oag.js';
import { PublicacionOagStore } from './publicacion-oag.store.js';

@Processor(OAG_QUEUE, {
  concurrency: 1,
  settings: { backoffStrategy: demoraReintentoOag },
})
export class OagProcessor extends WorkerHost {
  private readonly logger = new Logger(OagProcessor.name);

  constructor(private readonly oag: OagService) {
    super();
  }

  async process(job: Job<TrabajoOag>, token?: string) {
    if (job.name === 'recuperar') return this.oag.recuperar();
    if (job.name === 'programada') {
      try {
        return await this.oag.ejecutarProgramada(job.data.cron);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        this.logger.warn(error.getResponse());
        return;
      }
    }
    if (job.data.reintentarDesde && job.data.reintentarDesde > Date.now()) {
      await job.moveToDelayed(job.data.reintentarDesde, token);
      throw new DelayedError();
    }
    return this.oag.importar(job);
  }
}

export const proveedoresOag = [
  { provide: ADAPTADOR_OAG, useClass: AdaptadorOag },
  PublicacionOagStore,
  ConfiguracionOag,
  {
    provide: CargarOag,
    inject: [ADAPTADOR_OAG, PublicacionOagStore],
    useFactory: (
      adaptador: AdaptadorOperaciones<LecturaOag, OperacionOag, CursorOag>,
      repositorio: PublicacionOagStore,
    ) => new CargarOag(adaptador, repositorio),
  },
  OagService,
];

@Module({
  imports: [BullModule.registerQueue({ name: OAG_QUEUE })],
  exports: [OagService, ConfiguracionOag],
  controllers: [OagController],
  providers: [...proveedoresOag, OagProcessor],
})
export class OagModule {}
