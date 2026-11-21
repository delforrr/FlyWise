import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  mockCollection,
  mockDatabase,
} from '../../test/helpers/prisma-mock.js';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogIdentitiesController } from './catalog-identities.controller.js';

describe('API de correspondencias pendientes', () => {
  let app: INestApplication<App>;
  const identidades = mockCollection();
  const db = mockDatabase();
  const pendiente = {
    fuente: 'OurAirports',
    identificador: '123',
    aeropuertoId: null,
    rechazadoEn: null,
  };

  beforeAll(async () => {
    identidades.all.mockResolvedValue([]);
    identidades.first.mockResolvedValue(pendiente);
    identidades.update.mockResolvedValue(pendiente);
    identidades.updateAndCount.mockResolvedValue(7);
    (
      db.orm.public as unknown as Record<string, unknown>
    ).IdentidadAeropuertoFuente = identidades;
    const module = await Test.createTestingModule({
      controllers: [CatalogIdentitiesController],
      providers: [
        {
          provide: PrismaService,
          useValue: { models: { IdentidadAeropuertoFuente: identidades }, db },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(() => app.close());

  it('oculta las identidades rechazadas por defecto', async () => {
    await request(app.getHttpServer())
      .get('/administracion/fuentes/identidades')
      .expect(200, []);
    expect(identidades.where).toHaveBeenCalledWith({ aeropuertoId: null });
    expect(identidades.where).toHaveBeenCalledWith({ rechazadoEn: null });
  });

  it('permite consultar las identidades rechazadas', async () => {
    await request(app.getHttpServer())
      .get('/administracion/fuentes/identidades?rechazadas=true')
      .expect(200, []);
    expect(identidades.where).toHaveBeenCalledWith(expect.any(Function));
    expect(identidades.where).not.toHaveBeenCalledWith({ rechazadoEn: null });
  });

  it('rechaza todas las correspondencias pendientes de una vez', async () => {
    await request(app.getHttpServer())
      .patch('/administracion/fuentes/identidades/rechazar-todo')
      .expect(200, { rechazadas: 7 });
    expect(identidades.where).toHaveBeenCalledWith({
      aeropuertoId: null,
      rechazadoEn: null,
    });
    expect(identidades.where).toHaveBeenCalledWith(expect.any(Function));
    expect(identidades.updateAndCount).toHaveBeenCalledWith({
      rechazadoEn: expect.any(String),
    });
  });

  it('marca una correspondencia como rechazada', async () => {
    await request(app.getHttpServer())
      .patch('/administracion/fuentes/identidades/OurAirports/123/rechazo')
      .send({ rechazado: true })
      .expect(200);
    expect(identidades.update).toHaveBeenCalledWith({
      rechazadoEn: expect.any(String),
    });
  });

  it('restaura una correspondencia rechazada', async () => {
    identidades.first.mockResolvedValueOnce({
      ...pendiente,
      rechazadoEn: '2026-11-20 12:00:00',
    });
    await request(app.getHttpServer())
      .patch('/administracion/fuentes/identidades/OurAirports/123/rechazo')
      .send({ rechazado: false })
      .expect(200);
    expect(identidades.update).toHaveBeenCalledWith({ rechazadoEn: null });
  });

  it('rechaza solicitudes sin el estado explícito', async () => {
    await request(app.getHttpServer())
      .patch('/administracion/fuentes/identidades/OurAirports/123/rechazo')
      .send({})
      .expect(400);
  });
});
