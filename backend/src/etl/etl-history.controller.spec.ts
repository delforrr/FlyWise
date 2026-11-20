import { ServiciosOperacionesService } from './servicios-operaciones.service.js';
import type { Queue } from 'bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { mockCollection } from '../../test/helpers/prisma-mock.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EtlHistoryController } from './etl-history.controller.js';
import { PipelineController } from './pipeline.controller.js';
import { PipelinesService } from './pipelines.service.js';

describe('API de catálogos ETL', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const ejecuciones = mockCollection();
    ejecuciones.all.mockResolvedValue([
      {
        id: 'completed',
        mensajeError: 'error interno',
        instantaneaConfiguracion: { referencia: 'CREDENCIAL' },
        iniciadoEn: '2026-09-01 00:00:00',
        finalizadoEn: '2026-09-01 00:00:02',
      },
      { id: 'pending', iniciadoEn: null, finalizadoEn: null },
    ]);
    const module = await Test.createTestingModule({
      controllers: [EtlHistoryController, PipelineController],
      providers: [
        { provide: ServiciosOperacionesService, useValue: {} },
        {
          provide: PipelinesService,
          useValue: {
            getHistory: (id?: string, administrativo?: boolean) =>
              new PipelinesService(
                {
                  models: { EjecucionEtl: ejecuciones },
                } as unknown as PrismaService,
                {} as Queue,
              ).getHistory(id, administrativo),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('conserva el historial sin requerir rol ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/etl/historial')
      .expect(200, [
        {
          id: 'completed',
          iniciadoEn: '2026-09-01T00:00:00.000Z',
          finalizadoEn: '2026-09-01T00:00:02.000Z',
          durationMs: 2000,
        },
        {
          id: 'pending',
          iniciadoEn: null,
          finalizadoEn: null,
          durationMs: null,
        },
      ]);
    await request(app.getHttpServer()).get('/etl/procesos').expect(403);
  });

  it('retira la ejecución local y el estado de la cola anterior', async () => {
    await request(app.getHttpServer()).post('/etl/iniciar/all').expect(404);
    await request(app.getHttpServer()).get('/etl/estado').expect(404);
  });
});
