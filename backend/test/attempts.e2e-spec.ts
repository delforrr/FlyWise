import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EtlService } from '../src/etl/etl.service.js';
import { EtlProcessor } from '../src/etl/etl.processor.js';
import { PipelinesService } from '../src/etl/pipelines.service.js';

describe('Attempt audit (real BullMQ and PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it.each(['failed', 'stalled'] as const)(
    'keeps separate audit after a %s intento is recovered',
    async (recovery) => {
      const nombre = `flywise-validation-${randomUUID()}`;
      const conexion = {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      };
      const queue = new Queue(nombre, { connection: conexion });
      const eventos = new QueueEvents(nombre, { connection: conexion });
      let worker: Worker<{ jobId: string; dataset: string }> | undefined;
      let recoveredWorker:
        Worker<{ jobId: string; dataset: string }> | undefined;
      let firstPersisted!: () => void;
      const firstPersistence = new Promise<void>((resolve) => {
        firstPersisted = resolve;
      });
      const rollback = new Error('rollback intento fixtures');
      try {
        await eventos.waitUntilReady();
        await db.transaction(async (tx) => {
          const module = await Test.createTestingModule({
            providers: [
              EtlService,
              EtlProcessor,
              PipelinesService,
              { provide: getQueueToken('etl-queue'), useValue: queue },
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
          const processor = module.get(EtlProcessor);
          worker = new Worker<{ jobId: string; dataset: string }>(
            nombre,
            async (job) => {
              const result = await processor.process(job);
              if (recovery === 'stalled') {
                firstPersisted();
                await new Promise<void>(() => {});
              }
              if (job.attemptsMade === 0)
                throw new Error('simulated delivery failure after persistence');
              return result;
            },
            { connection: conexion, lockDuration: 1000, stalledInterval: 500 },
          );
          const record = await tx.orm.public.EjecucionEtl.create({
            fuente: 'aerolineas',
            estado: 'pending',
          });
          const job = await queue.add(
            'process-dataset',
            { jobId: record.id, dataset: 'aerolineas' },
            { attempts: 2 },
          );
          if (recovery === 'stalled') {
            await firstPersistence;
            await worker.close(true);
            recoveredWorker = new Worker<{ jobId: string; dataset: string }>(
              nombre,
              async (job) => processor.process(job),
              { connection: conexion, stalledInterval: 500 },
            );
          }
          await job.waitUntilFinished(eventos, 60000);
          const service = module.get(PipelinesService);
          expect(await service.job(record.id)).toMatchObject({
            intento: 2,
            filasTotales: 6162,
            filasDescartadas: 1,
          });
          expect(await service.samples(record.id)).toEqual([
            expect.objectContaining({ intento: 2 }),
          ]);
          expect(await service.samples(record.id, 1)).toEqual([
            expect.objectContaining({ intento: 1 }),
          ]);
          expect(
            (await service.eventos(record.id)).map((e) => e.intento),
          ).toEqual(expect.arrayContaining([1, 2]));
          expect(await service.eventos(record.id)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                intento: 2,
                mensaje: 'Inicio del intento 2',
              }),
            ]),
          );
          await worker.close();
          await recoveredWorker?.close();
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      } finally {
        await worker?.close();
        await recoveredWorker?.close(true);
        await eventos.close();
        await queue.obliterate();
        await queue.close();
      }
    },
    90000,
  );
});
