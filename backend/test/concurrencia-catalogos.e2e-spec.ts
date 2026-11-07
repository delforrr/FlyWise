import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Server } from 'node:http';
import { randomInt } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { disposableDatabase } from './helpers/disposable-database.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { RedisModule } from '../src/redis/redis.module.js';
import { AirportsModule } from '../src/airports/airports.module.js';
import { JwtAuthGuard, AdminGuard } from '../src/auth/auth.guard.js';
import { EtlService } from '../src/etl/etl.service.js';

describe('Administración e ingesta concurrentes (HTTP y PostgreSQL)', () => {
  const db = disposableDatabase();
  afterAll(() => db.close());

  it('actualiza ubicación por ingesta y conserva edición y archivo frente a importaciones concurrentes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-concurrencia-'));
    const file = join(directory, 'airports.dat');
    const idOpenflights = randomInt(900_000_000, 2_000_000_000);
    let app: INestApplication<Server> | undefined;
    try {
      const module = await Test.createTestingModule({
        imports: [PrismaModule, RedisModule, AirportsModule],
        providers: [
          EtlService,
          { provide: getQueueToken('etl-queue'), useValue: {} },
        ],
      })
        .overrideProvider(PrismaService)
        .useValue({ db, models: db.orm.public })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(AdminGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = module.createNestApplication<INestApplication<Server>>();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
      const etl = module.get(EtlService);
      const api = request(app.getHttpServer());
      const source = (lat: number, lng: number) =>
        `${idOpenflights},Importado,City,Argentina,\\N,\\N,${lat},${lng},0,0,N,UTC,airport,OpenFlights`;
      await writeFile(file, source(90, 180));
      await etl.importCatalog('aeropuertos', file);
      const airport = await db.orm.public.Aeropuerto.firstOrThrow({
        idOpenflights,
      });
      const nearby = async (lat: number, lng: number) =>
        (
          await api
            .get('/aeropuertos/cercanos')
            .query({ lat, lng, radiusKm: 1 })
            .expect(200)
        ).body as { id: string }[];
      expect(await nearby(90, 180)).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: airport.id })]),
      );
      await writeFile(file, source(-90, -180));
      await etl.importCatalog('aeropuertos', file);
      expect(await nearby(-90, -180)).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: airport.id })]),
      );
      expect((await nearby(90, 180)).some((row) => row.id === airport.id)).toBe(
        false,
      );
      await Promise.all([
        api
          .patch(`/administracion/aeropuertos/${airport.id}`)
          .send({ nombre: 'Edición manual concurrente' })
          .expect(200),
        etl.importCatalog('aeropuertos', file),
      ]);
      await etl.importCatalog('aeropuertos', file);
      expect(
        await db.orm.public.Aeropuerto.firstOrThrow({ id: airport.id }),
      ).toMatchObject({
        nombre: 'Edición manual concurrente',
        protegidoManualmente: true,
      });
      await Promise.all([
        api.delete(`/administracion/aeropuertos/${airport.id}`).expect(204),
        etl.importCatalog('aeropuertos', file),
      ]);
      await etl.importCatalog('aeropuertos', file);
      expect(
        (await db.orm.public.Aeropuerto.firstOrThrow({ id: airport.id }))
          .archivadoEn,
      ).not.toBeNull();
      expect(
        (await nearby(-90, -180)).some((row) => row.id === airport.id),
      ).toBe(false);
    } finally {
      await app?.close();
      await db.orm.public.Aeropuerto.where({ idOpenflights }).delete();
      await rm(directory, { recursive: true });
    }
  }, 30000);
});
