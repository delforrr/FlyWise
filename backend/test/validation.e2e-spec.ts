import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EtlService } from '../src/etl/etl.service.js';
import { AirlinesService } from '../src/airlines/airlines.service.js';
import { AirlinesController } from '../src/airlines/airlines.controller.js';
import { AirportsService } from '../src/airports/airports.service.js';
import { AirportsController } from '../src/airports/airports.controller.js';
import request from 'supertest';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';

describe('Data validation regressions (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  async function isolated(work: (tx: Transaction) => Promise<void>) {
    const rollback = new Error('rollback validation fixtures');
    try {
      await db.transaction(async (tx) => {
        await work(tx);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function importer(tx: Transaction) {
    const module = await Test.createTestingModule({
      providers: [
        EtlService,
        { provide: getQueueToken('etl-queue'), useValue: {} },
        {
          provide: PrismaService,
          useValue: {
            models: tx.orm.public,
            db: {
              raw: tx.raw,
              query: tx.query.bind(tx),
              execute: tx.execute.bind(tx),
              transaction: async <T>(
                work: (inner: Transaction) => Promise<T>,
              ) => work(tx),
            },
          },
        },
      ],
    }).compile();
    return module.get(EtlService);
  }
  it('returns 409 over HTTP for ambiguous airport and aerolinea codes', async () => {
    await isolated(async (tx) => {
      await tx.orm.public.Aerolinea.createAndCount([
        { nombre: 'Historical one', iata: 'ZZ' },
        { nombre: 'Historical two', iata: 'ZZ' },
      ]);
      await tx.orm.public.Aeropuerto.createAndCount([
        {
          nombre: 'Historical one',
          iata: 'ZZZ',
          nombrePais: 'Test',
          latitud: 0,
          longitud: 0,
        },
        {
          nombre: 'Historical two',
          iata: 'ZZZ',
          nombrePais: 'Test',
          latitud: 1,
          longitud: 1,
        },
      ]);
      const module = await Test.createTestingModule({
        controllers: [AirlinesController, AirportsController],
        providers: [
          AirlinesService,
          AirportsService,
          {
            provide: PrismaService,
            useValue: { models: tx.orm.public, db: tx },
          },
        ],
      }).compile();
      const app = module.createNestApplication<INestApplication<Server>>();
      await app.init();
      try {
        await request(app.getHttpServer())
          .get('/aerolineas/por-codigo/ZZ')
          .expect(409);
        await request(app.getHttpServer())
          .get('/aeropuertos/por-codigo/ZZZ')
          .expect(409);
      } finally {
        await app.close();
      }
    });
  });
  it('preserves stored codes on malformed updates, but clears explicitly missing codes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-code-update-'));
    try {
      await isolated(async (tx) => {
        const service = await importer(tx);
        const file = join(directory, 'countries.dat');
        await writeFile(file, 'Preserved fixture,AR,AR\n');
        await service.processCountries(file);
        await writeFile(file, 'Preserved fixture,INVALID,AR\n');
        await service.processCountries(file);
        expect(
          await tx.orm.public.Pais.first({ nombre: 'Preserved fixture' }),
        ).toMatchObject({ codigoIso: 'AR' });
        await writeFile(file, 'Preserved fixture,\\N,AR\n');
        await service.processCountries(file);
        expect(
          await tx.orm.public.Pais.first({ nombre: 'Preserved fixture' }),
        ).toMatchObject({ codigoIso: null });
        for (const dataset of ['aeropuertos', 'aerolineas'] as const) {
          const input = (iata: string, icao: string) =>
            dataset === 'aeropuertos'
              ? `2147483001,Preserved airport,City,Argentina,${iata},${icao},0,0,0,0,N,UTC,airport,OpenFlights\n`
              : `2147483001,Preserved aerolinea,Alias,${iata},${icao},Callsign,Argentina,Y\n`;
          const stored = () =>
            dataset === 'aeropuertos'
              ? tx.orm.public.Aeropuerto.first({ idOpenflights: 2147483001 })
              : tx.orm.public.Aerolinea.first({ idOpenflights: 2147483001 });
          const validIata = dataset === 'aeropuertos' ? 'ZZZ' : 'ZZ';
          const validIcao = dataset === 'aeropuertos' ? 'ZZZZ' : 'ZZZ';
          await writeFile(file, input(validIata, validIcao));
          await service.importCatalog(dataset, file);
          await writeFile(file, input('INVALID', 'INVALID'));
          await service.importCatalog(dataset, file);
          expect(await stored()).toMatchObject({
            iata: validIata,
            icao: validIcao,
          });
          await writeFile(file, input('\\N', '\\N'));
          await service.importCatalog(dataset, file);
          expect(await stored()).toMatchObject({ iata: null, icao: null });
        }
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  });
  it('rejects a required optional code after normalization and records its motivo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-required-e2e-'));
    try {
      const file = join(directory, 'paises.csv');
      await writeFile(file, 'nombre,iso\nRequired fixture,INVALID\n');
      await isolated(async (tx) => {
        const service = await importer(tx);
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'paises',
          estado: 'running',
        });
        const result = await service.importCatalog('paises', file, job.id, {
          conexion: {
            tipoFuente: 'http_stream',
            metodoHttp: 'GET',
            formatoDatos: 'csv',
            csvConCabecera: true,
            urlEndpoint: 'https://raw.githubusercontent.com/fixture',
          },
          mapeoEsquema: [
            { columnaOrigen: 'nombre', campoDestino: 'nombre' },
            { columnaOrigen: 'iso', campoDestino: 'codigoIso', required: true },
          ],
          configuracionProgramacion: {
            expresionCron: '',
            tamanoLote: 1000,
            tiempoLimiteSegundos: 30,
            maximoReintentos: 0,
          },
        });
        expect(result).toMatchObject({ processed: 0, discarded: 1 });
        expect(
          await tx.orm.public.Pais.first({ nombre: 'Required fixture' }),
        ).toBeNull();
        expect(
          await tx.orm.public.MuestraDescartadaEtl.where({
            ejecucionId: job.id,
          }).first(),
        ).toMatchObject({
          campo: 'codigoIso',
          motivo: 'codigoIso: obligatorio o inválido',
        });
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
