import { openFlightsFixture } from './helpers/catalog-file.js';
import { CatalogImportService } from '../src/etl/catalog-import.service.js';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { disposableDatabase } from './helpers/disposable-database.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { catalogSnapshot, mockCatalogHttp } from './helpers/catalog-http.js';

const openCsvSource = await mockCatalogHttp(
  openFlightsFixture('countries.dat'),
);
const { EtlProcessor } = await import('../src/etl/etl.processor.js');
const { PipelinesService } = await import('../src/etl/pipelines.service.js');

describe('Encolado y reintento real (BullMQ y PostgreSQL)', () => {
  it('procesa un pipeline HTTP y conserva su historial al reintentar', async () => {
    const db = disposableDatabase();
    const name = `flywise-review-${randomUUID()}`;
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const queue = new Queue(name, { connection });
    const events = new QueueEvents(name, { connection });
    const ids: string[] = [];
    let procesoId: string | undefined;
    let worker: Worker | undefined;
    try {
      const prisma = { db, models: db.orm.public } as PrismaService;
      const module = await Test.createTestingModule({
        providers: [
          CatalogImportService,
          PipelinesService,
          { provide: PrismaService, useValue: prisma },
          { provide: getQueueToken('etl-queue'), useValue: queue },
        ],
      }).compile();
      const pipelines = module.get(PipelinesService);
      const processor = new EtlProcessor(
        module.get(CatalogImportService),
        prisma,
        pipelines,
      );
      worker = new Worker(
        name,
        (job: Job<{ jobId: string; dataset: string }>) =>
          processor.process(job),
        { connection },
      );
      await events.waitUntilReady();
      const snapshot = catalogSnapshot('paises');
      const proceso = await pipelines.create({
        nombre: `Catálogo de prueba ${name}`,
        nombreConjunto: 'paises',
        entidadDestino: 'paises',
        ...snapshot,
      });
      procesoId = proceso.id;
      const first = (await pipelines.run(procesoId))!;
      ids.push(first.ejecucionId);
      const job = await queue.getJob(first.ejecucionId);
      expect(job).toBeDefined();
      await job!.waitUntilFinished(events, 15000);
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
      const cargasLocales = await Promise.all(
        ['all', 'paises'].map((fuente) =>
          db.orm.public.EjecucionEtl.create({ fuente, estado: 'pending' }),
        ),
      );
      ids.push(...cargasLocales.map(({ id }) => id));
      const [encolada, huerfana] = cargasLocales;
      const localJob = await queue.add(
        'process-dataset',
        { jobId: encolada.id, dataset: 'all' },
        { jobId: encolada.id, attempts: 3 },
      );
      await expect(localJob.waitUntilFinished(events, 15000)).rejects.toThrow(
        /carga local fue retirada/,
      );
      expect((await queue.getJob(localJob.id!))?.attemptsMade).toBe(1);
      await pipelines.onModuleInit();
      for (const { id } of [encolada, huerfana]) {
        expect(await pipelines.job(id)).toMatchObject({
          estado: 'failed',
          filasProcesadas: 0,
        });
        expect(await pipelines.eventos(id)).toEqual([
          expect.objectContaining({
            nivel: 'error',
            mensaje: expect.stringContaining('carga local fue retirada'),
          }),
        ]);
        await expect(pipelines.retry(id, 'unused')).rejects.toMatchObject({
          status: 409,
        });
      }
      expect(openCsvSource).toHaveBeenCalledTimes(2);
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
      if (procesoId)
        await db.orm.public.ProcesoEtl.where({ id: procesoId }).delete();
      await db.close();
    }
  }, 30000);
});
