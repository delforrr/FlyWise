import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents, Worker, type Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createDatabase } from '../src/prisma/db.js';

const fixture =
  'Fecha UTC;Hora UTC;Clase de Vuelo (todos los vuelos);Clasificación Vuelo;Tipo de Movimiento;Aeropuerto;Origen / Destino;Aerolinea Nombre;Aeronave;Matrícula;Pasajeros;PAX;Calidad dato\n01/08/2026;0:01;Regular;Doméstico;Despegue;AER;CBA;Operador ANAC;B738;LV-AAA;120;120;PROVISORIO\n31/08/2026;0:01;Regular;Doméstico;Aterrizaje;CBA;AER;Operador ANAC;B738;LV-AAA;120;0;PROVISORIO\n';
let attempts = 0;
jest.unstable_mockModule('../src/etl/http-source.js', () => ({
  validateSourceUrl: (input: string) => new URL(input),
  openCsvSource: (config: { urlEndpoint: string }) => {
    if (!config.urlEndpoint.endsWith('.csv'))
      return Promise.resolve(
        Readable.from([
          '<a href="https://datos.transporte.gob.ar/dataset/anac/resource/7b6d0103-0a69-4c67-aed9-33cb58ae12f5/download/revision.csv">Descargar</a>',
        ]),
      );
    attempts++;
    return Promise.resolve(
      Readable.from([
        attempts === 1
          ? fixture.replace(';120;120;', ';inválido;120;')
          : fixture,
      ]),
    );
  },
}));

describe('ANAC: jobs y recuperación real', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('reintenta una carga incompleta sin publicar duplicados y conserva el intento rechazado', async () => {
    const { ActividadService } =
      await import('../src/actividad/actividad.service.js');
    const { ActividadProcessor } =
      await import('../src/actividad/actividad.processor.js');
    const name = `anac-jobs-${randomUUID()}`;
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const queue = new Queue(name, { connection });
    const events = new QueueEvents(name, { connection });
    let worker: Worker | undefined;
    const rollback = new Error('rollback ANAC jobs');
    try {
      await db.transaction(async (tx) => {
        const module = await Test.createTestingModule({
          providers: [
            ActividadService,
            ActividadProcessor,
            { provide: getQueueToken('actividad-queue'), useValue: queue },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  raw: tx.raw,
                  query: tx.query.bind(tx),
                  execute: tx.execute.bind(tx),
                  transaction: async <T>(
                    work: (inner: typeof tx) => Promise<T>,
                  ) => work(tx),
                },
              },
            },
          ],
        }).compile();
        const service = module.get(ActividadService),
          processor = module.get(ActividadProcessor);
        worker = new Worker(
          name,
          (job: Job<{ ejecucionId: string }>) => processor.process(job),
          { connection },
        );
        await events.waitUntilReady();
        const result = await service.ejecutar('2026-08');
        const job = await queue.getJob(result!.ejecucionId);
        await job!.waitUntilFinished(events, 20000);
        expect(await service.ejecuciones()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: result!.ejecucionId,
              estado: 'completed',
              intento: 2,
              filasProcesadas: 2,
              filasDescartadas: 0,
            }),
          ]),
        );
        expect(
          await service.consultar({
            periodo: '2026-08',
            pagina: 1,
            limite: 20,
          }),
        ).toMatchObject({ total: 2, cobertura: { filasProcesadas: 2 } });
        const rejected = await service.muestras(result!.ejecucionId, 1);
        expect(rejected).toMatchObject([
          { numeroFila: 1, motivo: 'Pasajeros inválido' },
        ]);
        await job!.remove();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await worker?.close();
      await events.close();
      await queue.close();
    }
  }, 30000);
});
