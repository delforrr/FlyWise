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
    'keeps separate audit after a %s attempt is recovered',
    async (recovery) => {
      const name = `flywise-validation-${randomUUID()}`;
      const connection = {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      };
      const queue = new Queue(name, { connection });
      const events = new QueueEvents(name, { connection });
      let worker: Worker<{ jobId: string; dataset: string }> | undefined;
      let recoveredWorker:
        Worker<{ jobId: string; dataset: string }> | undefined;
      let firstPersisted!: () => void;
      const firstPersistence = new Promise<void>((resolve) => {
        firstPersisted = resolve;
      });
      const rollback = new Error('rollback attempt fixtures');
      try {
        await events.waitUntilReady();
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
            name,
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
            { connection, lockDuration: 1000, stalledInterval: 500 },
          );
          const record = await tx.orm.public.EtlJob.create({
            source: 'airlines',
            status: 'pending',
          });
          const job = await queue.add(
            'process-dataset',
            { jobId: record.id, dataset: 'airlines' },
            { attempts: 2 },
          );
          if (recovery === 'stalled') {
            await firstPersistence;
            await worker.close(true);
            recoveredWorker = new Worker<{ jobId: string; dataset: string }>(
              name,
              async (job) => processor.process(job),
              { connection, stalledInterval: 500 },
            );
          }
          await job.waitUntilFinished(events, 60000);
          const service = module.get(PipelinesService);
          expect(await service.job(record.id)).toMatchObject({
            attempt: 2,
            totalRows: 6162,
            discardedRows: 1,
          });
          expect(await service.samples(record.id)).toEqual([
            expect.objectContaining({ attempt: 2 }),
          ]);
          expect(await service.samples(record.id, 1)).toEqual([
            expect.objectContaining({ attempt: 1 }),
          ]);
          expect(
            (await service.events(record.id)).map((e) => e.attempt),
          ).toEqual(expect.arrayContaining([1, 2]));
          expect(await service.events(record.id)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                attempt: 2,
                message: 'Inicio del intento 2',
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
        await events.close();
        await queue.obliterate();
        await queue.close();
      }
    },
    90000,
  );
});
