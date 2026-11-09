import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { Server } from 'node:http';
import request from 'supertest';
import { BtsController } from '../src/bts/bts.controller.js';
import { BtsService } from '../src/bts/bts.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createDatabase } from '../src/prisma/db.js';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { VuelosService } from '../src/vuelos/vuelos.service.js';
import { MetricsService } from '../src/metrics/metrics.service.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { CatalogIdentitiesController } from '../src/etl/catalog-identities.controller.js';

describe('BTS mensual por HTTP y jobs', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('encola y publica un mes completo con identidades resueltas, y conserva la cobertura ante un fallo', async () => {
    const rollback = new Error('rollback BTS');
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const queue = new Queue(`bts-test-${randomUUID()}`, { connection });
    let rol = 'ADMIN';
    try {
      await db.transaction(async (tx) => {
        const module = await Test.createTestingModule({
          controllers: [
            BtsController,
            MetricsController,
            CatalogIdentitiesController,
          ],
          providers: [
            BtsService,
            VuelosService,
            MetricsService,
            {
              provide: getQueueToken('bts-queue'),
              useValue: queue,
            },
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
                  ) => {
                    await tx.execute(
                      tx.raw.sql`SAVEPOINT bts_test`.affectedCount().build(),
                    );
                    try {
                      return await work(tx);
                    } catch (error) {
                      await tx.execute(
                        tx.raw.sql`ROLLBACK TO SAVEPOINT bts_test`
                          .affectedCount()
                          .build(),
                      );
                      throw error;
                    } finally {
                      await tx.execute(
                        tx.raw.sql`RELEASE SAVEPOINT bts_test`
                          .affectedCount()
                          .build(),
                      );
                    }
                  },
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
                .getRequest<{ user: { rol: string } }>().user = { rol };
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
          await api
            .patch('/administracion/bts/configuracion')
            .send({ periodo: '2026-13', pausado: true, expresionCron: '' })
            .expect(400);
          await api
            .patch('/administracion/bts/configuracion')
            .send({
              periodo: '2026-08',
              pausado: true,
              expresionCron: '',
              extra: true,
            })
            .expect(400);
          await api
            .patch('/administracion/bts/configuracion')
            .send({ periodo: '2026-08', pausado: true, expresionCron: '' })
            .expect(200);
          expect(
            (await api.get('/administracion/bts/configuracion').expect(200))
              .body,
          ).toMatchObject({ periodo: '2026-08', pausado: true });
          await api.post('/administracion/bts/ejecutar').expect(409);
          const job = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          const csv =
            'FlightDate,DOT_ID_Reporting_Airline,Flight_Number_Reporting_Airline,OriginAirportID,DestAirportID,CRSDepTime,ArrDelay,Cancelled,Diverted,Origin,Dest,IATA_CODE_Reporting_Airline\n2026-08-01,19393,101,10397,12892,0800,-5,0,0,ATL,LAX,WN\n';
          await expect(
            module
              .get(BtsService)
              .procesar(job.id, '2026-08', Readable.from([csv])),
          ).rejects.toThrow('correspondencias');
          expect(
            (await api.get('/administracion/bts/cobertura').expect(200)).body,
          ).toEqual([]);
          const catalogPending = (
            await api
              .get('/administracion/fuentes/identidades')
              .query({ busqueda: '10397' })
              .expect(200)
          ).body;
          expect(catalogPending).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ fuente: 'BTS' }),
            ]),
          );
          expect(
            (await api.get('/administracion/bts/correspondencias').expect(200))
              .body,
          ).toMatchObject({
            total: 2,
            datos: expect.arrayContaining([
              expect.objectContaining({ identificador: '10397' }),
            ]),
          });
          expect(
            (
              await api
                .get('/administracion/bts/correspondencias')
                .query({ tipo: 'operadores' })
                .expect(200)
            ).body,
          ).toMatchObject({
            total: 1,
            datos: [
              expect.objectContaining({ identificador: '19393', codigo: 'WN' }),
            ],
          });
          expect(
            (
              await api
                .get(`/administracion/bts/ejecuciones/${job.id}/descartes`)
                .expect(200)
            ).body,
          ).toEqual([
            expect.objectContaining({
              numeroFila: 1,
              motivo: 'Faltan correspondencias BTS explícitas',
            }),
          ]);
          await api
            .patch('/administracion/bts/configuracion')
            .send({
              periodo: '2026-08',
              pausado: false,
              expresionCron: '* * * * *',
            })
            .expect(400);
          await api
            .patch('/administracion/bts/configuracion')
            .send({ periodo: '2026-08', pausado: false, expresionCron: '' })
            .expect(200);
          const { ejecucionId } = (
            await api.post('/administracion/bts/ejecutar').expect(201)
          ).body as { ejecucionId: string };
          await api.post('/administracion/bts/ejecutar').expect(409);
          await (await queue.getJob(ejecucionId))!.remove();
          await module.get(BtsService).onModuleInit();
          expect(await queue.getJob(ejecucionId)).toBeDefined();
          const country = await tx.orm.public.Pais.create({
            nombre: `BTS fixture ${randomUUID()}`,
          });
          const origin = await tx.orm.public.Aeropuerto.create({
            nombre: 'Origen BTS fixture',
            nombrePais: country.nombre,
            paisId: country.id,
            latitud: 0,
            longitud: 0,
            ubicacion: ubicacionAeropuerto(0, 0),
          });
          const destination = await tx.orm.public.Aeropuerto.create({
            nombre: 'Destino BTS fixture',
            nombrePais: country.nombre,
            paisId: country.id,
            latitud: 1,
            longitud: 1,
            ubicacion: ubicacionAeropuerto(1, 1),
          });
          const airline = await tx.orm.public.Aerolinea.create({
            nombre: 'Operador BTS fixture',
          });
          await api
            .patch('/administracion/bts/correspondencias')
            .send({
              tipo: 'aeropuertos',
              identificador: '10397',
              entidadId: origin.id,
            })
            .expect(200);
          await api
            .patch('/administracion/bts/correspondencias')
            .send({
              tipo: 'aeropuertos',
              identificador: '12892',
              entidadId: origin.id,
            })
            .expect(409);
          await api
            .patch('/administracion/bts/correspondencias')
            .send({
              tipo: 'aeropuertos',
              identificador: '12892',
              entidadId: destination.id,
            })
            .expect(200);
          await api
            .patch('/administracion/bts/correspondencias')
            .send({
              tipo: 'operadores',
              identificador: '19393',
              entidadId: airline.id,
            })
            .expect(200);
          const archivo = join(process.cwd(), 'test/fixtures/bts-month.zip');
          const events = new QueueEvents(queue.name, { connection });
          const queuedJob = await queue.getJob(ejecucionId);
          const worker = new Worker<{ ejecucionId: string; periodo: string }>(
            queue.name,
            ({ data }) => {
              if (data.periodo === '2026-07')
                throw new Error('Worker interrumpido');
              return module
                .get(BtsService)
                .importar(data.ejecucionId, data.periodo, archivo);
            },
            { connection },
          );
          try {
            await events.waitUntilReady();
            expect(await queuedJob!.waitUntilFinished(events, 10000)).toEqual({
              procesadas: 31,
              insertadas: 31,
              descartadas: 0,
            });
            const interrumpida = await tx.orm.public.EjecucionEtl.create({
              fuente: 'BTS',
              estado: 'running',
              instantaneaConfiguracion: {
                conexion: { periodo: '2026-07' },
                mapeoEsquema: [],
                configuracionProgramacion: {},
              },
            });
            const fallida = await queue.add(
              'mes',
              { ejecucionId: interrumpida.id, periodo: '2026-07' },
              { jobId: interrumpida.id, attempts: 1 },
            );
            await expect(
              fallida.waitUntilFinished(events, 10000),
            ).rejects.toThrow('Worker interrumpido');
            await module.get(BtsService).onModuleInit();
            expect(
              (await api.get('/administracion/bts/ejecuciones').expect(200))
                .body,
            ).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  id: interrumpida.id,
                  periodo: '2026-07',
                  estado: 'failed',
                }),
              ]),
            );
          } finally {
            await worker.close();
            await events.close();
          }
          expect(
            (await api.get('/administracion/bts/cobertura').expect(200)).body,
          ).toEqual([
            expect.objectContaining({
              periodo: '2026-08',
              filas: 31,
              ejecucionId,
            }),
          ]);
          await module.get(MetricsService).recalcularPendientes();
          const query = {
            periodo: '2026-08',
            origenId: origin.id,
            destinoId: destination.id,
          };
          expect(
            (await api.get('/metricas/rutas').query(query).expect(200)).body,
          ).toMatchObject({
            datos: [
              expect.objectContaining({
                otp15: 50,
                vuelosOperados: 4,
                vuelosTotales: 31,
                fuentes: ['BTS'],
              }),
            ],
          });
          const retry = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          expect(
            await module
              .get(BtsService)
              .importar(
                retry.id,
                '2026-08',
                join(process.cwd(), 'test/fixtures/bts-month.zip'),
              ),
          ).toEqual({ procesadas: 31, insertadas: 0, descartadas: 0 });
          // BullMQ may deliver a previously committed job again after losing its lock.
          expect(
            await module
              .get(BtsService)
              .importar(ejecucionId, '2026-08', 'never-read.zip'),
          ).toEqual({ procesadas: 31, insertadas: 31, descartadas: 0 });
          const broken = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          await expect(
            module
              .get(BtsService)
              .procesar(broken.id, '2026-08', Readable.from([csv])),
          ).rejects.toThrow('Mes incompleto');
          expect(
            (await api.get('/administracion/bts/cobertura').expect(200)).body,
          ).toEqual([
            expect.objectContaining({
              periodo: '2026-08',
              filas: 31,
              ejecucionId: retry.id,
            }),
          ]);
          const revision = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          expect(
            await module
              .get(BtsService)
              .importar(
                revision.id,
                '2026-08',
                join(process.cwd(), 'test/fixtures/bts-month-revision.zip'),
              ),
          ).toEqual({ procesadas: 31, insertadas: 1, descartadas: 0 });
          await module.get(MetricsService).recalcularPendientes();
          expect(
            (await api.get('/metricas/rutas').query(query).expect(200)).body,
          ).toMatchObject({
            datos: [
              expect.objectContaining({
                otp15: 50,
                vuelosOperados: 4,
                vuelosTotales: 31,
              }),
            ],
          });
          rol = 'USER';
          await api.get('/administracion/bts/configuracion').expect(403);
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await queue.obliterate();
      await queue.close();
    }
  }, 20000);
});
