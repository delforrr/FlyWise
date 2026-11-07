import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { AirportsController } from '../src/airports/airports.controller.js';
import { AirportsService } from '../src/airports/airports.service.js';
import { RoutesController } from '../src/routes/routes.controller.js';
import { RoutesService } from '../src/routes/routes.service.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { crearOfertaFixture } from './helpers/oferta-fixture.js';

describe('Country localization contracts (HTTP and PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());

  it('exposes country ISO without replacing original names across airport and route queries', async () => {
    const rollback = new Error('rollback country localization fixtures');
    try {
      await db.transaction(async (tx) => {
        const country = await tx.orm.public.Pais.create({
          nombre: `United Kingdom ${randomUUID()}`,
          codigoIso: 'GB',
        });
        const origin = await tx.orm.public.Aeropuerto.create({
          nombre: 'Localization fixture origin',
          ciudad: 'London',
          nombrePais: 'United Kingdom',
          paisId: country.id,
          iata: 'QVA',
          icao: 'ZQVA',
          latitud: 0,
          longitud: 0,
          ubicacion: ubicacionAeropuerto(0, 0),
          cantidadRutas: 1000000000,
        });
        const destination = await tx.orm.public.Aeropuerto.create({
          nombre: 'Localization fixture destination',
          ciudad: 'Original city',
          nombrePais: 'Original country',
          iata: 'QVB',
          icao: 'ZQVB',
          latitud: 1,
          longitud: 1,
          ubicacion: ubicacionAeropuerto(1, 1),
          cantidadRutas: 1000000000,
        });
        await crearOfertaFixture(tx, {
          origenId: origin.id,
          destinoId: destination.id,
          codigoAerolinea: 'T1',
        });
        const module = await Test.createTestingModule({
          controllers: [AirportsController, RoutesController],
          providers: [
            AirportsService,
            RoutesService,
            {
              provide: PrismaService,
              useValue: { models: tx.orm.public, db: tx },
            },
            {
              provide: RedisService,
              useValue: {
                get: () => Promise.resolve(null),
                set: () => Promise.resolve(),
              },
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
          const http = request(app.getHttpServer());
          const byCode = await http
            .get('/aeropuertos/por-codigo/ZQVA')
            .expect(200);
          expect(byCode.body).toMatchObject({
            id: origin.id,
            nombrePais: 'United Kingdom',
            ciudad: 'London',
            codigoIsoPais: 'GB',
          });
          const catalog = await http
            .get('/aeropuertos/catalogo')
            .query({ limit: 1000, offset: 0 })
            .expect(200);
          expect(catalog.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: origin.id, codigoIsoPais: 'GB' }),
              expect.objectContaining({
                id: destination.id,
                codigoIsoPais: null,
              }),
            ]),
          );
          const search = await http
            .get('/aeropuertos/buscar')
            .query({ q: 'ZQVA' })
            .expect(200);
          expect((search.body as unknown[])[0]).toMatchObject({
            id: origin.id,
            codigoIsoPais: 'GB',
          });
          const nearby = await http
            .get('/aeropuertos/cercanos')
            .query({ lat: 0, lng: 0, radiusKm: 200 })
            .expect(200);
          expect(nearby.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: origin.id, codigoIsoPais: 'GB' }),
              expect.objectContaining({
                id: destination.id,
                codigoIsoPais: null,
              }),
            ]),
          );
          const direct = await http
            .get('/rutas/directas')
            .query({ origen: 'ZQVA', destino: 'ZQVB' })
            .expect(200);
          expect(direct.body).toMatchObject({
            origen: { pais: 'United Kingdom', codigoIsoPais: 'GB' },
            destino: { pais: 'Original country', codigoIsoPais: null },
          });
          const arcs = await http
            .get('/rutas/explorar')
            .query({ origenId: origin.id, destinoId: destination.id })
            .expect(200);
          expect((arcs.body as unknown[])[0]).toMatchObject({
            origen: { id: origin.id, codigoIsoPais: 'GB' },
            destino: { id: destination.id, codigoIsoPais: null },
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
