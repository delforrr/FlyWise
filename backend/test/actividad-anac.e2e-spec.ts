import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { Queue } from 'bullmq';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { ActividadController } from '../src/actividad/actividad.controller.js';
import { ActividadService } from '../src/actividad/actividad.service.js';

import { fixture } from './helpers/actividad-anac-fixture.js';

describe('ANAC: movimientos y revisiones por HTTP', () => {
  const db = createDatabase();
  const queue = new Queue(`anac-test-${randomUUID()}`, {
    connection: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });
  afterAll(async () => {
    await queue.close();
    await db.close();
  });
  it('publica el mes atómicamente y distingue movimientos, conectividad, Pasajeros y PAX', async () => {
    const rollback = new Error('rollback ANAC');
    let role = 'ADMIN';
    try {
      await db.transaction(async (tx) => {
        const module = await Test.createTestingModule({
          controllers: [ActividadController],
          providers: [
            ActividadService,
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
        })
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate(ctx: ExecutionContext) {
              ctx.switchToHttp().getRequest<{ user: { rol: string } }>().user =
                { rol: role };
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
        try {
          const api = request(app.getHttpServer() as Server);
          const service = module.get(ActividadService);
          const job = await tx.orm.public.EjecucionEtl.create({
            id: randomUUID(),
            fuente: 'ANAC',
            estado: 'running',
            intento: 1,
            iniciadoEn: '2020-01-01 00:00:00',
          });
          await service.importar(
            Readable.from([fixture]),
            '2026-08',
            job.id,
            'https://datos.transporte.gob.ar/fixture.csv',
          );
          const result = (
            await api
              .get('/administracion/actividad-anac')
              .query({ periodo: '2026-08' })
              .expect(200)
          ).body as { datos: unknown[] };
          expect(result).toMatchObject({
            total: 31,
            resumen: [
              {
                clasificacion: 'Doméstico',
                movimientos: 31,
                despegues: 1,
                aterrizajes: 30,
                pasajeros: 240,
                pax: 120,
              },
            ],
            cobertura: {
              estado: 'publicada',
              filasProcesadas: 31,
              filasDescartadas: 0,
            },
          });
          expect(result.datos).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                movimiento: 'ATERRIZAJE',
                origen: 'AER',
                destino: 'CBA',
                calidad: 'PROVISORIO',
              }),
            ]),
          );
          const connections = (
            await api
              .get('/administracion/actividad-anac/conectividad')
              .query({ periodo: '2026-08' })
              .expect(200)
          ).body;
          expect(connections).toMatchObject({
            datos: [
              {
                origen: 'AER',
                destino: 'CBA',
                movimientosSalida: 1,
                pasajeros: 120,
              },
            ],
          });
          await api
            .get('/administracion/actividad-anac')
            .query({ periodo: '2026-13' })
            .expect(400);
          await api
            .get('/administracion/actividad-anac')
            .query({ periodo: '2026-08', limite: 101 })
            .expect(400);
          const failed = await tx.orm.public.EjecucionEtl.create({
            fuente: 'ANAC',
            estado: 'running',
            intento: 1,
            iniciadoEn: '2020-01-01 00:00:00',
          });
          await expect(
            service.importar(
              Readable.from([
                fixture.replace(';120;120;', ';desconocido;120;'),
              ]),
              '2026-08',
              failed.id,
              'https://datos.transporte.gob.ar/revision.csv',
            ),
          ).rejects.toThrow('filas rechazadas');
          const unchanged = (
            await api
              .get('/administracion/actividad-anac')
              .query({ periodo: '2026-08' })
              .expect(200)
          ).body;
          expect(unchanged).toMatchObject({
            total: 31,
            cobertura: { revisionId: job.id },
          });
          const revisions = (
            await api
              .get('/administracion/actividad-anac/revisiones')
              .query({ periodo: '2026-08' })
              .expect(200)
          ).body;
          expect(revisions).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: failed.id,
                estado: 'rechazada',
                filasDescartadas: 1,
              }),
            ]),
          );
          const revision = await tx.orm.public.EjecucionEtl.create({
            fuente: 'ANAC',
            estado: 'running',
            intento: 1,
            iniciadoEn: '2020-01-01 00:00:00',
          });
          await service.importar(
            Readable.from([
              fixture
                .replace('Aerolinea Nombre', 'Aerolínea Nombre')
                .replace(';120;120;', ';125;125;')
                .replace(';120;0;', ';125;0;'),
            ]),
            '2026-08',
            revision.id,
            'https://datos.transporte.gob.ar/revision.csv',
          );
          const revised = (
            await api
              .get('/administracion/actividad-anac')
              .query({ periodo: '2026-08' })
              .expect(200)
          ).body;
          expect(revised).toMatchObject({
            total: 31,
            resumen: [{ pasajeros: 250, pax: 125 }],
            cobertura: { revisionId: revision.id },
          });
          const truncated = await tx.orm.public.EjecucionEtl.create({
            fuente: 'ANAC',
            estado: 'running',
            intento: 1,
            iniciadoEn: '2020-01-01 00:00:00',
          });
          const truncatedCsv = fixture
            .split('\n')
            .filter((row) => !row.startsWith('15/08/2026;'))
            .join('\n');
          await expect(
            service.importar(
              Readable.from([truncatedCsv]),
              '2026-08',
              truncated.id,
              'https://datos.transporte.gob.ar/truncado.csv',
            ),
          ).rejects.toThrow('no abarca todo el mes');
          await service.importar(
            Readable.from([truncatedCsv]),
            '2026-08',
            job.id,
            'https://datos.transporte.gob.ar/no-reemplazar.csv',
          );
          expect(
            (
              await api
                .get('/administracion/actividad-anac')
                .query({ periodo: '2026-08' })
                .expect(200)
            ).body,
          ).toMatchObject({
            cobertura: { revisionId: revision.id },
            total: 31,
          });
          expect(
            (
              await api
                .get('/administracion/actividad-anac/revisiones')
                .query({ periodo: '2026-08' })
                .expect(200)
            ).body,
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: job.id,
                estado: 'publicada',
                vigente: false,
                filasProcesadas: 31,
                uri: 'https://datos.transporte.gob.ar/fixture.csv',
              }),
              expect.objectContaining({
                id: truncated.id,
                estado: 'rechazada',
                vigente: false,
              }),
            ]),
          );
          expect(await service.ejecuciones()).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: revision.id,
                estado: 'completed',
                filasProcesadas: 31,
                finalizadoEn: expect.any(String),
              }),
            ]),
          );
          const empty = await tx.orm.public.EjecucionEtl.create({
            fuente: 'ANAC',
            estado: 'running',
            intento: 1,
            iniciadoEn: '2020-01-01 00:00:00',
          });
          await expect(
            service.importar(
              Readable.from([fixture]),
              '2025-01',
              empty.id,
              'https://datos.transporte.gob.ar/revision.csv',
            ),
          ).rejects.toThrow('no contiene movimientos');
          await api
            .patch('/administracion/actividad-anac/configuracion')
            .send({
              fichaUrl: 'https://localhost/archivo/anac',
              expresionCron: '0 5 20 * *',
              pausado: true,
            })
            .expect(400);
          await api
            .patch('/administracion/actividad-anac/configuracion')
            .send({
              fichaUrl:
                'https://datos.transporte.gob.ar/dataset/anac/archivo/recurso',
              expresionCron: '* * * * *',
              pausado: true,
            })
            .expect(400);
          role = 'OPERATOR';
          await api
            .get('/administracion/actividad-anac')
            .query({ periodo: '2026-08' })
            .expect(403);
          await api
            .post('/administracion/actividad-anac/ejecutar')
            .send({ periodo: '2026-08' })
            .expect(403);
          throw rollback;
        } finally {
          await app.close();
        }
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 30000);
});
