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
  it('returns 409 over HTTP for ambiguous airport and airline codes', async () => {
    await isolated(async (tx) => {
      await tx.orm.public.Airline.createAndCount([
        { name: 'Historical one', iata: 'ZZ' },
        { name: 'Historical two', iata: 'ZZ' },
      ]);
      await tx.orm.public.Airport.createAndCount([
        {
          name: 'Historical one',
          iata: 'ZZZ',
          countryName: 'Test',
          latitude: 0,
          longitude: 0,
        },
        {
          name: 'Historical two',
          iata: 'ZZZ',
          countryName: 'Test',
          latitude: 1,
          longitude: 1,
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
        await request(app.getHttpServer()).get('/airlines/ZZ').expect(409);
        await request(app.getHttpServer()).get('/airports/ZZZ').expect(409);
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
          await tx.orm.public.Country.first({ name: 'Preserved fixture' }),
        ).toMatchObject({ isoCode: 'AR' });
        await writeFile(file, 'Preserved fixture,\\N,AR\n');
        await service.processCountries(file);
        expect(
          await tx.orm.public.Country.first({ name: 'Preserved fixture' }),
        ).toMatchObject({ isoCode: null });
        for (const dataset of ['airports', 'airlines'] as const) {
          const input = (iata: string, icao: string) =>
            dataset === 'airports'
              ? `2147483001,Preserved airport,City,Argentina,${iata},${icao},0,0,0,0,N,UTC,airport,OpenFlights\n`
              : `2147483001,Preserved airline,Alias,${iata},${icao},Callsign,Argentina,Y\n`;
          const stored = () =>
            dataset === 'airports'
              ? tx.orm.public.Airport.first({ openflightsId: 2147483001 })
              : tx.orm.public.Airline.first({ openflightsId: 2147483001 });
          const validIata = dataset === 'airports' ? 'ZZZ' : 'ZZ';
          const validIcao = dataset === 'airports' ? 'ZZZZ' : 'ZZZ';
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
  it('rejects a required optional code after normalization and records its reason', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-required-e2e-'));
    try {
      const file = join(directory, 'countries.csv');
      await writeFile(file, 'name,iso\nRequired fixture,INVALID\n');
      await isolated(async (tx) => {
        const service = await importer(tx);
        const job = await tx.orm.public.EtlJob.create({
          source: 'countries',
          status: 'running',
        });
        const result = await service.importCatalog('countries', file, job.id, {
          connection: {
            sourceType: 'http_stream',
            httpMethod: 'GET',
            dataFormat: 'csv',
            csvHasHeader: true,
            endpointUrl: 'https://raw.githubusercontent.com/fixture',
          },
          schemaMapping: [
            { sourceColumn: 'name', targetField: 'name' },
            { sourceColumn: 'iso', targetField: 'isoCode', required: true },
          ],
          scheduleConfig: {
            cronExpression: '',
            batchSize: 1000,
            timeoutSeconds: 30,
            maxRetries: 0,
          },
        });
        expect(result).toMatchObject({ processed: 0, discarded: 1 });
        expect(
          await tx.orm.public.Country.first({ name: 'Required fixture' }),
        ).toBeNull();
        expect(
          await tx.orm.public.EtlDiscardedSample.where({
            jobId: job.id,
          }).first(),
        ).toMatchObject({
          field: 'isoCode',
          reason: 'isoCode: obligatorio o inválido',
        });
      });
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
