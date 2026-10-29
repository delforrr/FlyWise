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

describe('Data validation regressions (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  async function isolated(work: (tx: Transaction) => Promise<void>) {
    const rollback = new Error('rollback validation fixtures');
    try {
      await db.transaction(async (tx) => { await work(tx); throw rollback; });
    } catch (error) { if (error !== rollback) throw error; }
  }
  async function importer(tx: Transaction) {
    const module = await Test.createTestingModule({ providers: [
      EtlService,
      { provide: getQueueToken('etl-queue'), useValue: {} },
      { provide: PrismaService, useValue: { models: tx.orm.public, db: {
        raw: tx.raw, query: tx.query.bind(tx), execute: tx.execute.bind(tx),
        transaction: async <T>(work: (inner: Transaction) => Promise<T>) => work(tx),
      } } },
    ] }).compile();
    return module.get(EtlService);
  }
  it('returns 409 over HTTP for ambiguous airport and airline codes', async () => {
    await isolated(async (tx) => {
      await tx.orm.public.Airline.createAndCount([{ name: 'Historical one', iata: 'ZZ' }, { name: 'Historical two', iata: 'ZZ' }]);
      await tx.orm.public.Airport.createAndCount([{ name: 'Historical one', iata: 'ZZZ', countryName: 'Test', latitude: 0, longitude: 0 }, { name: 'Historical two', iata: 'ZZZ', countryName: 'Test', latitude: 1, longitude: 1 }]);
      const module = await Test.createTestingModule({ controllers: [AirlinesController, AirportsController], providers: [AirlinesService, AirportsService, { provide: PrismaService, useValue: { models: tx.orm.public, db: tx } }] }).compile();
      const app = module.createNestApplication();
      await app.init();
      try {
        await request(app.getHttpServer()).get('/airlines/ZZ').expect(409);
        await request(app.getHttpServer()).get('/airports/ZZZ').expect(409);
      } finally { await app.close(); }
    });
  });
  it('rejects a required optional code after normalization and records its reason', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-required-e2e-'));
    try {
      const file = join(directory, 'countries.csv');
      await writeFile(file, 'name,iso\nRequired fixture,INVALID\n');
      await isolated(async (tx) => {
        const service = await importer(tx);
        const job = await tx.orm.public.EtlJob.create({ source: 'countries', status: 'running' });
        const result = await service.importCatalog('countries', file, job.id, {
          connection: { sourceType: 'http_stream', httpMethod: 'GET', dataFormat: 'csv', csvHasHeader: true, endpointUrl: 'https://raw.githubusercontent.com/fixture' },
          schemaMapping: [{ sourceColumn: 'name', targetField: 'name' }, { sourceColumn: 'iso', targetField: 'isoCode', required: true }],
          scheduleConfig: { cronExpression: '', batchSize: 1000, timeoutSeconds: 30, maxRetries: 0 },
        });
        expect(result).toMatchObject({ processed: 0, discarded: 1 });
        expect(await tx.orm.public.Country.first({ name: 'Required fixture' })).toBeNull();
        expect(await tx.orm.public.EtlDiscardedSample.where({ jobId: job.id }).first()).toMatchObject({ field: 'isoCode', reason: 'isoCode: obligatorio o inválido' });
      });
    } finally { await rm(directory, { recursive: true }); }
  });
});
