import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import type { Server } from 'node:http';
import { mkdtemp, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { Queue, Worker } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { EurocontrolProcessor } from '../src/indicadores/eurocontrol.processor.js';
import { EurocontrolService } from '../src/indicadores/eurocontrol.service.js';
import { IndicadoresController } from '../src/indicadores/indicadores.controller.js';
import type { EurocontrolProduct } from '../src/indicadores/indicadores.dto.js';

type ConsultaResultado = {
  total: number;
  datos: {
    instantaneaId: string;
    atribucion: string;
    valores: Record<string, number | null>;
  }[];
};

async function fixture(
  path: string,
  name:
    | 'network'
    | 'stakeholder'
    | 'invalid'
    | 'network-gap'
    | 'network-warmup-only'
    | 'stakeholder-incomplete',
) {
  await copyFile(
    new URL(`./fixtures/eurocontrol/${name}.xlsx`, import.meta.url),
    path,
  );
}

async function insertUnlistedWorksheet(path: string) {
  const xlsx = await readFile(path);
  const end = xlsx.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const directory = xlsx.readUInt32LE(end + 16);
  const filename = Buffer.from('xl/worksheets/sheet3.xml');
  const payload = Buffer.from(
    '<worksheet><sheetData><row r="1"><c r="A1"><v>7</v></c></row></sheetData></worksheet>',
  );
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt32LE(crc32(payload), 14);
  header.writeUInt32LE(payload.length, 18);
  header.writeUInt32LE(payload.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const unlisted = Buffer.concat([header, filename, payload]);
  xlsx.writeUInt32LE(directory + unlisted.length, end + 16);
  await writeFile(
    path,
    Buffer.concat([
      xlsx.subarray(0, directory),
      unlisted,
      xlsx.subarray(directory),
    ]),
  );
}
describe('EUROCONTROL: indicadores nativos y publicación atómica', () => {
  const db = createDatabase();
  const queue = new Queue<{
    producto: EurocontrolProduct;
    ejecucionId?: string;
  }>(`eurocontrol-test-${process.pid}`, {
    connection: { host: 'localhost', port: 6379 },
  });
  afterAll(async () => {
    await queue.removeJobScheduler('eurocontrol-network');
    await queue.removeJobScheduler('eurocontrol-stakeholder');
    await queue.close();
    await db.close();
  });
  it('separa identidades DY/WK/Y2D, conserva cero y contadores y no publica archivos parciales', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flywise-euro-'));
    const rollback = new Error('rollback eurocontrol');
    const iniciadoEn = new Date().toISOString().slice(0, -1).replace('T', ' ');
    let role = 'ADMIN';
    const queued: string[] = [];
    try {
      await db.transaction(async (tx) => {
        const orphan = await tx.orm.public.EjecucionEtl.create({
          fuente: 'EUROCONTROL:network',
          estado: 'pending',
        });
        const stranded = await tx.orm.public.EjecucionEtl.create({
          fuente: 'EUROCONTROL:network',
          estado: 'running',
          iniciadoEn,
        });
        queued.push(orphan.id, stranded.id);
        await queue.add(
          'import-eurocontrol',
          { producto: 'network', ejecucionId: stranded.id },
          { jobId: stranded.id },
        );
        const worker = new Worker(queue.name, null, {
          autorun: false,
          connection: { host: 'localhost', port: 6379 },
        });
        try {
          const job = await worker.getNextJob('fixture-lock', { block: false });
          await job.moveToFailed(
            new Error('worker previo interrumpido'),
            'fixture-lock',
            false,
          );
        } finally {
          await worker.close();
        }
        const module = await Test.createTestingModule({
          controllers: [IndicadoresController],
          providers: [
            EurocontrolService,
            { provide: getQueueToken('eurocontrol-queue'), useValue: queue },
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
        })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate(context: ExecutionContext) {
              context
                .switchToHttp()
                .getRequest<{ user: { rol: string } }>().user = {
                rol: role,
              };
              return true;
            },
          })
          .compile();
        const app = module.createNestApplication();
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        );
        await app.init();
        const api = request(app.getHttpServer() as Server);
        try {
          expect(await (await queue.getJob(orphan.id))?.getState()).toBe(
            'waiting',
          );
          expect(await (await queue.getJob(stranded.id))?.getState()).toBe(
            'waiting',
          );
          const service = module.get(EurocontrolService);
          const path = join(directory, 'fixture.xlsx');
          const historyBefore = await api
            .get('/administracion/indicadores/eurocontrol/instantaneas')
            .query({ producto: 'network', limite: 1 })
            .expect(200);
          const job = await tx.orm.public.EjecucionEtl.create({
            fuente: 'EUROCONTROL:stakeholder',
            estado: 'running',
            iniciadoEn,
            intento: 1,
          });
          await fixture(path, 'stakeholder');
          await service.importWorkbook('stakeholder', path, job.id);
          const result = await api
            .get('/administracion/indicadores/eurocontrol')
            .query({
              producto: 'stakeholder',
              ambito: 'COUNTRY',
              mes: '2026-08',
            })
            .expect(200);
          expect(result.body).toMatchObject({
            total: 3,
            datos: expect.arrayContaining([
              expect.objectContaining({
                entidad: 'Spain',
                granularidad: 'DY',
                desde: '2026-08-31',
                hasta: '2026-08-31',
              }),
              expect.objectContaining({
                entidad: 'Finland',
                granularidad: 'WK',
                desde: '2026-08-25',
                hasta: '2026-08-31',
              }),
              expect.objectContaining({
                entidad: 'Norway',
                granularidad: 'Y2D',
                desde: '2026-01-01',
                hasta: '2026-08-31',
              }),
            ]),
          });
          const stakeholder = (result.body as ConsultaResultado).datos[0];
          expect(stakeholder.valores).toMatchObject({
            ARR_SCHED: 20,
            ARR_PUNCTUAL: 17,
            MISSING_SCHED_FLIGHTS: 2,
          });
          expect(stakeholder.atribucion).toContain('EUROCONTROL');
          const airport = await api
            .get('/administracion/indicadores/eurocontrol')
            .query({
              producto: 'stakeholder',
              ambito: 'AIRPORT',
              entidad: 'EFHK',
              granularidad: 'WK',
            })
            .expect(200);
          expect(airport.body).toMatchObject({
            total: 1,
            datos: [
              expect.objectContaining({ entidad: 'EFHK', nombre: 'Finland' }),
            ],
          });
          const networkJob = await tx.orm.public.EjecucionEtl.create({
            fuente: 'EUROCONTROL:network',
            estado: 'running',
            iniciadoEn,
            intento: 1,
          });
          await fixture(path, 'network');
          await insertUnlistedWorksheet(path);
          await service.importWorkbook('network', path, networkJob.id);
          const network = await api
            .get('/administracion/indicadores/eurocontrol')
            .query({ producto: 'network', granularidad: 'DY', mes: '2026-08' })
            .expect(200);
          expect(network.body).toMatchObject({
            total: 1,
            datos: [
              expect.objectContaining({
                valores: expect.objectContaining({
                  ARR_PUN: 0,
                  ARR_PUNCTUAL_FLIGHTS: 0,
                  ARR_SCHED_FLIGHTS: 10,
                }),
              }),
            ],
          });
          for (const [product, name, reason] of [
            ['network', 'network-gap', 'Fecha no consecutiva'],
            [
              'network',
              'network-warmup-only',
              'Cobertura semanal EUROCONTROL ausente',
            ],
            ['stakeholder', 'stakeholder-incomplete', 'Bloque incompleto'],
          ] as const) {
            const job = await tx.orm.public.EjecucionEtl.create({
              fuente: `EUROCONTROL:${product}`,
              estado: 'running',
              iniciadoEn,
              intento: 1,
            });
            await fixture(path, name);
            await expect(
              service.importWorkbook(product, path, job.id),
            ).rejects.toThrow(reason);
          }
          await fixture(path, 'invalid');
          const failed = await tx.orm.public.EjecucionEtl.create({
            fuente: 'EUROCONTROL:network',
            estado: 'running',
            iniciadoEn,
            intento: 1,
          });
          await expect(
            service.importWorkbook('network', path, failed.id),
          ).rejects.toThrow();
          const after = await api
            .get('/administracion/indicadores/eurocontrol')
            .query({ producto: 'network', granularidad: 'DY', mes: '2026-08' })
            .expect(200);
          const networkSnapshotId = (network.body as ConsultaResultado).datos[0]
            .instantaneaId;
          expect((after.body as ConsultaResultado).datos[0].instantaneaId).toBe(
            networkSnapshotId,
          );
          await api
            .get('/administracion/indicadores/eurocontrol')
            .query({ limite: 101 })
            .expect(400);
          await api
            .get('/administracion/indicadores/eurocontrol')
            .query({ mes: '2026-13' })
            .expect(400);
          role = 'OPERATOR';
          await api.get('/administracion/indicadores/eurocontrol').expect(403);
          role = 'ADMIN';
          await api
            .patch('/administracion/indicadores/eurocontrol/fuentes/network')
            .send({ pausado: true })
            .expect(200);
          expect(await service.enqueue('network', undefined, true)).toEqual({
            pausado: true,
          });
          const queuedResponse = await api
            .post(
              '/administracion/indicadores/eurocontrol/fuentes/network/ejecutar',
            )
            .expect(201);
          const queuedId = (queuedResponse.body as { ejecucionId: string })
            .ejecucionId;
          queued.push(queuedId);
          const queuedJob = await queue.getJob(queuedId);
          expect(queuedJob).toBeDefined();
          service.download = () =>
            Promise.resolve({ path, cleanup: () => Promise.resolve() });
          const processor = new EurocontrolProcessor(
            service,
            module.get(PrismaService),
          );
          await expect(processor.process(queuedJob!)).rejects.toThrow(
            'Fecha EUROCONTROL inválida',
          );
          const sources = await api
            .get('/administracion/indicadores/eurocontrol/fuentes')
            .expect(200);
          expect(sources.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                producto: 'network',
                ultimaEjecucion: expect.objectContaining({
                  estado: 'failed',
                  filas_procesadas: 1000,
                }),
              }),
            ]),
          );
          const retry = await api
            .post(
              `/administracion/indicadores/eurocontrol/ejecuciones/${queuedId}/reintentar`,
            )
            .expect(201);
          queued.push((retry.body as { ejecucionId: string }).ejecucionId);
          expect((retry.body as { ejecucionId: string }).ejecucionId).not.toBe(
            queuedId,
          );
          const oldSnapshot = await api
            .get('/administracion/indicadores/eurocontrol')
            .query({
              producto: 'network',
              instantaneaId: networkSnapshotId,
            })
            .expect(200);
          expect((oldSnapshot.body as ConsultaResultado).total).toBe(2);
          const history = await api
            .get('/administracion/indicadores/eurocontrol/instantaneas')
            .query({ producto: 'network', pagina: 2, limite: 1 })
            .expect(200);
          const previousTotal = (historyBefore.body as { total: number }).total;
          expect(history.body).toMatchObject({ total: previousTotal + 1 });
          expect(
            (history.body as { datos: { id: string }[] }).datos,
          ).toHaveLength(previousTotal ? 1 : 0);
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      for (const id of queued) await (await queue.getJob(id))?.remove();
      await rm(directory, { recursive: true });
    }
  });
});
