import { crearOfertaFixture } from './helpers/oferta-fixture.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoutesService } from '../src/routes/routes.service.js';
import { RoutesController } from '../src/routes/routes.controller.js';

describe('Ruta identity validation (HTTP and PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('normalizes IATA/ICAO, rejects equal endpoints and returns a real direct route', async () => {
    const rollback = new Error('rollback route fixtures');
    try {
      await db.transaction(async (tx) => {
        const origen = await tx.orm.public.Aeropuerto.create({
          nombre: 'Identity origen',
          iata: 'QVA',
          icao: 'ZQVA',
          nombrePais: 'Test',
          latitud: 0,
          longitud: 0,
        });
        const destino = await tx.orm.public.Aeropuerto.create({
          nombre: 'Identity destino',
          iata: 'QVB',
          icao: 'ZQVB',
          nombrePais: 'Test',
          latitud: 1,
          longitud: 1,
        });
        await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: destino.id,
        });
        const module = await Test.createTestingModule({
          controllers: [RoutesController],
          providers: [
            RoutesService,
            {
              provide: PrismaService,
              useValue: { models: tx.orm.public, db: tx },
            },
          ],
        }).compile();
        const app = module.createNestApplication<INestApplication<Server>>();
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        );
        await app.init();
        try {
          await request(app.getHttpServer())
            .get('/rutas/directas')
            .query({ origen: 'PKN', destino: ' pkn ' })
            .expect(400);
          await request(app.getHttpServer())
            .get('/rutas/directas')
            .query({ origen: 'QVA', destino: 'ZQVA' })
            .expect(400);
          await request(app.getHttpServer())
            .get('/rutas/directas')
            .query({ origen: '???', destino: 'QVB' })
            .expect(400);
          await request(app.getHttpServer())
            .get('/rutas/explorar')
            .query({ origenId: origen.id, destinoId: origen.id })
            .expect(400);
          const response = await request(app.getHttpServer())
            .get('/rutas/directas')
            .query({ origen: ' zqva ', destino: 'qvb' })
            .expect(200);
          expect(response.body).toMatchObject({
            origen: { iata: 'QVA' },
            destino: { iata: 'QVB' },
          });
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
