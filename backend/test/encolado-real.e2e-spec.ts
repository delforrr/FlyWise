import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './helpers/disposable-database.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EtlService } from '../src/etl/etl.service.js';
import { EtlProcessor } from '../src/etl/etl.processor.js';
import { PipelinesService } from '../src/etl/pipelines.service.js';

describe('Encolado y reintento real (BullMQ y PostgreSQL)', () => {
  it('procesa una ejecución local y conserva su historial al reintentar', async () => {
    const db = disposableDatabase();
    const name = `flywise-review-${randomUUID()}`;
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const queue = new Queue(name, { connection });
    const events = new QueueEvents(name, { connection });
    const ids: string[] = [];
    let worker: Worker | undefined;
    try {
      const module = await Test.createTestingModule({
        providers: [
          EtlService,
          EtlProcessor,
          PipelinesService,
          { provide: PrismaService, useValue: { db, models: db.orm.public } },
          { provide: getQueueToken('etl-queue'), useValue: queue },
        ],
      }).compile();
      const processor = module.get(EtlProcessor);
      worker = new Worker(
        name,
        (job: Job<{ jobId: string; dataset: string }>) =>
          processor.process(job),
        { connection },
      );
      await events.waitUntilReady();
      const first = await module.get(EtlService).triggerJob('paises');
      ids.push(first.ejecucionId);
      const job = await queue.getJob(first.ejecucionId);
      expect(job).toBeDefined();
      await job!.waitUntilFinished(events, 15000);
      const pipelines = module.get(PipelinesService);
      expect(await pipelines.job(first.ejecucionId)).toMatchObject({
        estado: 'completed',
        intento: 1,
        filasProcesadas: 261,
      });
      expect(await pipelines.eventos(first.ejecucionId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mensaje: 'Ingesta completada' }),
        ]),
      );
      const user = await db.orm.public.Usuario.create({
        correo: `${randomUUID()}@example.test`,
        hashContrasena: 'fixture',
      });
      try {
        const retry = await pipelines.retry(first.ejecucionId, user.id);
        ids.push(retry.ejecucionId);
        await (await queue.getJob(retry.ejecucionId))!.waitUntilFinished(
          events,
          15000,
        );
        expect(retry.ejecucionId).not.toBe(first.ejecucionId);
        expect(await pipelines.job(retry.ejecucionId)).toMatchObject({
          estado: 'completed',
          solicitanteId: user.id,
        });
        expect((await pipelines.job(first.ejecucionId)).estado).toBe(
          'completed',
        );
      } finally {
        await db.orm.public.Usuario.where({ id: user.id }).delete();
      }
      await module.close();
    } finally {
      await worker?.close();
      await events.close();
      await queue.obliterate();
      await queue.close();
      for (const id of ids) {
        await db.orm.public.EventoEjecucionEtl.where({
          ejecucionId: id,
        }).deleteAndCount();
        await db.orm.public.MuestraDescartadaEtl.where({
          ejecucionId: id,
        }).deleteAndCount();
        await db.orm.public.EjecucionEtl.where({ id }).delete();
      }
      await db.close();
    }
  }, 30000);
});
