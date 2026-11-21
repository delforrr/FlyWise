import { PROCESO_OAG_ID } from '../src/ingestion/infrastructure/cron-operaciones.js';
import { ConfiguracionOag } from '../src/adapters/oag/configuracion-oag.js';
import { PublicacionOagStore } from '../src/adapters/oag/publicacion-oag.store.js';
import { CargarOag } from '../src/ingestion/application/oag/cargar-oag.js';
import { jest } from '@jest/globals';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import {
  ADAPTADOR_BTS,
  AdaptadorBts,
} from '../src/adapters/bts/adaptador-bts.js';
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
import { VuelosController } from '../src/vuelos/vuelos.controller.js';
import { VuelosService } from '../src/vuelos/vuelos.service.js';
import { MetricsService } from '../src/metrics/metrics.service.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { CatalogIdentitiesController } from '../src/etl/catalog-identities.controller.js';
import { OagService } from '../src/adapters/oag/oag.service.js';
import { AdaptadorOag } from '../src/adapters/oag/adaptador-oag.js';
import { periodosCerradosMapa } from '../src/metrics/periodos-mapa.js';

describe('BTS mensual por HTTP y jobs', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('reserva el cupo entre commit y encolado mientras arranca otra réplica', async () => {
    const primera = new PrismaService();
    const segunda = new PrismaService();
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const nombre = `bts-replicas-${randomUUID()}`;
    const cola = new Queue(nombre, { connection });
    const colaReplica = new Queue(nombre, { connection });
    const colaOag: ConstructorParameters<typeof OagService>[1] = new Queue(
      `oag-replicas-${randomUUID()}`,
      { connection },
    );
    const bts = (prisma: PrismaService, queue: Queue) =>
      new BtsService(
        prisma,
        queue,
        new VuelosService(prisma),
        new AdaptadorBts(),
      );
    const configOag = new ConfiguracionOag(segunda, colaOag);
    const repositorio = new PublicacionOagStore(segunda);
    const oag = new OagService(
      segunda,
      colaOag,
      configOag,
      new CargarOag(new AdaptadorOag(), repositorio),
      repositorio,
    );
    const periodo = periodosCerradosMapa()[0];
    const anterior = process.env.OAG_SUBSCRIPTION_KEY;
    process.env.OAG_SUBSCRIPTION_KEY = 'credencial-sintetica';
    const configuracionPreviaOag = await db.orm.public.ProcesoEtl.first({
      id: PROCESO_OAG_ID,
    });
    const configuracionPreviaBts = await db.orm.public.ConfiguracionBts.first({
      id: true,
    });
    const ids: string[] = [];
    let procesoId: string | undefined;
    let ejecucionId: string | undefined;
    let avisoEncolado!: (id: string) => void;
    const intentoEncolado = new Promise<string>((resolve) => {
      avisoEncolado = resolve;
    });
    let liberar!: () => void;
    const interrumpir = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    let solicitud: ReturnType<BtsService['ejecutar']> | undefined;
    try {
      for (const icao of ['ZXQB', 'ZXQC']) {
        const aeropuerto = await db.orm.public.Aeropuerto.create({
          icao,
          nombre: icao,
          nombrePais: 'Argentina',
          latitud: 0,
          longitud: 0,
          ubicacion: ubicacionAeropuerto(0, 0),
        });
        ids.push(aeropuerto.id);
      }
      const proceso = await db.orm.public.ProcesoEtl.create({
        nombre: nombre,
        nombreConjunto: 'Operaciones de vuelos',
        entidadDestino: 'otp_metrics',
        pausado: false,
        conexion: {},
        mapeoEsquema: [],
        configuracionProgramacion: {},
      });
      procesoId = proceso.id;
      const alcance = await configOag.resolverAlcance({
        periodo,
        origenId: ids[0],
        destinoId: ids[1],
        coberturaMinimaPct: 90,
      });
      const expresionCron = '0 4 15 * *';
      const configBts = bts(primera, cola);
      await configOag.inicializar();
      const manualOag = {
        periodo,
        origenId: ids[0],
        destinoId: ids[1],
        coberturaMinimaPct: 90,
        pausado: false,
      };
      const manualBts = { periodo, pausado: false, expresionCron: '' };
      const cronOag = { ...manualOag, expresionCron };
      const cronBts = { ...manualBts, expresionCron };
      await configOag.configurar({ ...manualOag, expresionCron: '' });
      await configBts.configurar(manualBts);
      const resultados = await Promise.allSettled([
        configOag.configurar(cronOag),
        configBts.configurar(cronBts),
      ]);
      expect(
        resultados.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        resultados.find(({ status }) => status === 'rejected'),
      ).toMatchObject({
        reason: { status: 409 },
      });
      if (resultados[0].status === 'fulfilled') {
        expect(await configBts.configuracion()).toEqual(manualBts);
        expect(await colaOag.getJobScheduler('oag-mensual')).toMatchObject({
          pattern: expresionCron,
        });
        await configOag.configurar({ ...manualOag, expresionCron: '' });
        await configBts.configurar(cronBts);
      } else {
        expect(await configOag.configuracion()).toEqual(manualOag);
        expect(await cola.getJobScheduler('bts-mensual')).toMatchObject({
          pattern: expresionCron,
        });
        await configBts.configurar(manualBts);
        await configOag.configurar(cronOag);
        await expect(configBts.configurar(cronBts)).rejects.toMatchObject({
          status: 409,
        });
        await configOag.configurar({ ...manualOag, expresionCron: '' });
        await configBts.configurar(cronBts);
      }
      await expect(configOag.configurar(cronOag)).rejects.toMatchObject({
        status: 409,
      });
      expect(await configOag.configuracion()).toEqual(manualOag);

      jest
        .spyOn(cola, 'add')
        .mockImplementationOnce(async (_nombre, _datos, opts) => {
          avisoEncolado(opts!.jobId!);
          await interrumpir;
          throw new Error('Conexión interrumpida después del commit');
        });
      solicitud = bts(primera, cola).ejecutar(periodo, undefined, true);
      ejecucionId = await Promise.race([
        intentoEncolado,
        solicitud.then(() => {
          throw new Error('No se reprodujo la interrupción');
        }),
      ]);
      expect(await colaReplica.getJob(ejecucionId)).toBeUndefined();
      const [, conflicto] = await Promise.allSettled([
        bts(segunda, colaReplica).onModuleInit(),
        oag.ejecutar(undefined, alcance, undefined, [], {
          id: proceso.id,
          actualizadoEn: proceso.actualizadoEn,
        }),
      ]).then(([replica, conflicto]) => {
        if (replica.status === 'rejected') throw replica.reason;
        return [replica, conflicto] as const;
      });
      expect(conflicto).toMatchObject({
        status: 'rejected',
        reason: { status: 409, response: { ejecucionId } },
      });
      expect((await colaReplica.getJob(ejecucionId))?.data).toEqual({
        ejecucionId,
        periodo,
      });
      liberar();
      await expect(solicitud).resolves.toEqual({ ejecucionId });
    } finally {
      liberar();
      await solicitud?.catch(() => undefined);
      await colaOag.obliterate();
      if (configuracionPreviaOag) {
        const { pausado, conexion, configuracionProgramacion } =
          configuracionPreviaOag;
        await db.orm.public.ProcesoEtl.where({ id: PROCESO_OAG_ID }).update({
          pausado,
          conexion,
          configuracionProgramacion,
        });
      } else {
        await db.orm.public.ProcesoEtl.where({ id: PROCESO_OAG_ID }).delete();
      }
      if (configuracionPreviaBts) {
        const { pausado, periodo, expresionCron } = configuracionPreviaBts;
        await db.orm.public.ConfiguracionBts.where({ id: true }).update({
          pausado,
          periodo,
          expresionCron,
        });
      } else {
        await db.orm.public.ConfiguracionBts.where({ id: true }).delete();
      }
      await colaReplica.obliterate();
      await Promise.all([cola.close(), colaReplica.close(), colaOag.close()]);
      if (ejecucionId)
        await db.orm.public.EjecucionEtl.where({ id: ejecucionId }).delete();
      if (procesoId)
        await db.orm.public.ProcesoEtl.where({ id: procesoId }).delete();
      await db.orm.public.Aeropuerto.where((a) =>
        a.id.in(ids),
      ).deleteAndCount();
      await Promise.all([primera.db.close(), segunda.db.close()]);
      if (anterior === undefined) delete process.env.OAG_SUBSCRIPTION_KEY;
      else process.env.OAG_SUBSCRIPTION_KEY = anterior;
    }
  }, 15000);

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
            VuelosController,
          ],
          providers: [
            { provide: ADAPTADOR_BTS, useClass: AdaptadorBts },
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
                  sql: tx.sql,
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
        app.useGlobalFilters(new HttpExceptionFilter());
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
            'FlightDate,DOT_ID_Reporting_Airline,Flight_Number_Reporting_Airline,OriginAirportID,DestAirportID,CRSDepTime,ArrDelay,Cancelled,Diverted,Origin,Dest,IATA_CODE_Reporting_Airline\n2026-08-01,19393,101,10397,12892,0800,-5,0,0,ZZQ,ZZR,0Z\n';
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
              expect.objectContaining({ identificador: '19393', codigo: '0Z' }),
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
            async ({ data, name }) => {
              if (name === 'recuperar') return;
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
            await module.get(BtsService).recuperar();
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
          expect(
            (
              await api
                .get('/administracion/vuelos')
                .query({
                  fuente: 'BTS',
                  origenId: origin.id,
                  periodo: '2026-08',
                })
                .expect(200)
            ).body,
          ).toMatchObject({
            total: 31,
            datos: expect.arrayContaining([
              expect.objectContaining({
                fechaVuelo: '2026-08-31',
                horarios: {
                  evidenciaFecha: 'fecha-informada',
                  salidaProgramadaUtc: null,
                  salidaRealUtc: null,
                  llegadaProgramadaUtc: null,
                  llegadaRealUtc: null,
                  desfaseOrigenMinutos: null,
                },
              }),
            ]),
          });
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
          expect(
            await tx.orm.public.MetricaRuta.first({
              origenId: origin.id,
              destinoId: destination.id,
              aerolineaId: airline.id,
              periodo: '2026-08-01',
            }),
          ).toMatchObject({ ejecucionEtlId: ejecucionId });
          const prepararMes = (periodo: string) =>
            tx.orm.public.EjecucionEtl.create({
              fuente: 'BTS',
              estado: 'pending',
              instantaneaConfiguracion: {
                conexion: { periodo },
                mapeoEsquema: [],
                configuracionProgramacion: {},
              },
            });
          const retry = await prepararMes('2026-08');
          expect(
            await module
              .get(BtsService)
              .importar(
                retry.id,
                '2026-08',
                join(process.cwd(), 'test/fixtures/bts-month.zip'),
              ),
          ).toEqual({ procesadas: 31, insertadas: 31, descartadas: 0 });
          await module.get(BtsService).recuperar();
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
          const operadoraAusente = await tx.orm.public.Aerolinea.create({
            nombre: 'BTS ausente en revisión',
          });
          const poblacionVacia = {
            origenId: origin.id,
            destinoId: destination.id,
            aerolineaId: operadoraAusente.id,
            periodo: '2026-08-01',
          };
          await tx.orm.public.MetricaRuta.create({
            ...poblacionVacia,
            ejecucionEtlId: retry.id,
            fuentes: ['BTS'],
            vuelosTotales: 1,
            actualizadoEn: '2026-09-01 00:00:00',
          });
          const revision = await prepararMes('2026-08');
          expect(
            await module
              .get(BtsService)
              .importar(
                revision.id,
                '2026-08',
                join(process.cwd(), 'test/fixtures/bts-month-revision.zip'),
              ),
          ).toEqual({ procesadas: 31, insertadas: 31, descartadas: 0 });
          await module.get(BtsService).recuperar();
          expect(
            await tx.orm.public.MetricaRuta.first(poblacionVacia),
          ).toMatchObject({
            vuelosTotales: 0,
            ejecucionEtlId: revision.id,
          });
          for (const id of [ejecucionId, retry.id, revision.id]) {
            const operaciones = await tx.orm.public.Vuelo.where({
              ejecucionEtlId: id,
            }).all();
            expect(operaciones).toHaveLength(31);
            expect(
              operaciones.every((vuelo) => vuelo.archivadoEn === null),
            ).toBe(true);
          }
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
          await tx.orm.public.Aeropuerto.where({ id: origin.id }).update({
            iata: 'QZX',
          });
          await tx.orm.public.Aeropuerto.where({ id: destination.id }).update({
            iata: 'QZY',
          });
          await tx.orm.public.Aerolinea.where({ id: airline.id }).update({
            iata: 'QZ',
          });
          const countryAirport = await tx.orm.public.Aeropuerto.create({
            nombre: 'Aeropuerto adicional BTS',
            nombrePais: country.nombre,
            paisId: country.id,
            iata: 'QZZ',
            latitud: 2,
            longitud: 2,
            ubicacion: ubicacionAeropuerto(2, 2),
          });
          await api
            .patch('/administracion/bts/configuracion')
            .send({ periodo: '2026-08', pausado: true, expresionCron: '' })
            .expect(200);
          const { ejecucionId: partialId } = (
            await api
              .post('/administracion/bts/ejecutar')
              .send({ periodo: '2026-07' })
              .expect(201)
          ).body as { ejecucionId: string };
          const [header] = csv.split('\n');
          const days = Array.from(
            { length: 31 },
            (_, day) =>
              `2026-07-${String(day + 1).padStart(2, '0')},19393,101,10397,99991,0800,-5,0,0,QZX,QZZ,WN`,
          );
          const unmapped =
            '2026-07-01,19393,102,10397,99992,0800,-5,0,0,QZX,ZZQ,WN';
          await expect(
            module
              .get(BtsService)
              .procesar(
                partialId,
                '2026-07',
                Readable.from([[header, ...days, unmapped].join('\n')]),
              ),
          ).resolves.toEqual({
            procesadas: 31,
            insertadas: 31,
            descartadas: 1,
          });
          expect(
            await tx.orm.public.IdentidadAeropuertoFuente.first({
              fuente: 'BTS',
              identificador: '99991',
            }),
          ).toMatchObject({ aeropuertoId: countryAirport.id });
          expect(
            (await api.get('/administracion/bts/cobertura').expect(200)).body,
          ).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({ periodo: '2026-07' }),
            ]),
          );
          const mesSinEvidencia = await prepararMes('2026-06');
          const junio = days
            .slice(0, 30)
            .map((fila, i) =>
              fila
                .replace('2026-07', '2026-06')
                .replace('0800,-5', i === 0 ? '0800,' : '0800,15'),
            );
          await module
            .get(BtsService)
            .procesar(
              mesSinEvidencia.id,
              '2026-06',
              Readable.from([[header, ...junio].join('\n')]),
            );
          await module.get(BtsService).recuperar();
          expect(
            (
              await api
                .get('/metricas/rutas')
                .query({
                  periodo: '2026-06',
                  origenId: origin.id,
                  destinoId: countryAirport.id,
                })
                .expect(200)
            ).body,
          ).toMatchObject({
            datos: [
              {
                vuelosTotales: 30,
                vuelosSinEvidencia: 1,
                vuelosPuntuales: 29,
                otp15: 100,
                fuentes: ['BTS'],
              },
            ],
          });
          const oag = await tx.orm.public.EjecucionEtl.create({
            fuente: 'OAG',
            estado: 'pending',
          });
          const conflicto = await api
            .post('/administracion/bts/ejecutar')
            .send({ periodo: '2026-06' })
            .expect(409);
          expect(conflicto.body).toMatchObject({ ejecucionId: oag.id });
          const fallida = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'failed',
          });
          const leer = jest.fn<() => Promise<Readable>>();
          await expect(
            module.get(BtsService).procesar(fallida.id, '2026-06', leer),
          ).rejects.toMatchObject({ response: { ejecucionId: oag.id } });
          expect(leer).not.toHaveBeenCalled();
          expect(
            await tx.orm.public.EjecucionEtl.first({ id: fallida.id }),
          ).toMatchObject({ estado: 'failed' });
          await tx.orm.public.EjecucionEtl.where({ id: oag.id }).update({
            estado: 'completed',
            iniciadoEn: '2026-07-01 00:00:00',
            finalizadoEn: '2026-07-01 00:01:00',
          });
          const autorizada = {
            origenId: origin.id,
            destinoId: countryAirport.id,
            aerolineaId: airline.id,
          };
          const poblacion = { ...autorizada, periodo: '2026-06-01' };
          await tx.orm.public.MetricaRuta.where(poblacion).update({
            ejecucionEtlId: oag.id,
            fuentes: ['OAG'],
            vuelosPuntuales: 0,
          });
          const iniciarBts = async (
            autorizarCambioFuente: (typeof autorizada)[],
          ) => {
            const response = await api
              .post('/administracion/bts/ejecutar')
              .send({
                periodo: '2026-06',
                autorizarCambioFuente,
              })
              .expect(201);
            const { ejecucionId } = response.body as { ejecucionId: string };
            await module
              .get(BtsService)
              .procesar(
                ejecucionId,
                '2026-06',
                Readable.from([[header, ...junio].join('\n')]),
              );
            await module.get(BtsService).recuperar();
            return ejecucionId;
          };
          await iniciarBts([]);
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: oag.id,
            vuelosPuntuales: 0,
          });
          const btsAutorizada = await iniciarBts([autorizada]);
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: btsAutorizada,
            vuelosPuntuales: 29,
          });
          const diagnostico = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          const filasInvalidas = [
            junio[0].replace('19393', '?'),
            junio[1].replace('0800', '2500'),
            junio[2].replace('2026-06', '2026-05'),
          ];
          await expect(
            module
              .get(BtsService)
              .procesar(
                diagnostico.id,
                '2026-06',
                Readable.from([
                  [header, ...junio, junio[0], ...filasInvalidas].join('\n'),
                ]),
              ),
          ).rejects.toThrow('Mes incompleto');
          const eventos = await tx.orm.public.EventoEjecucionEtl.where({
            ejecucionId: diagnostico.id,
            nivel: 'error',
          }).all();
          expect(eventos).toEqual([
            expect.objectContaining({
              mensaje: expect.stringContaining(
                'identidad 2, formato 1, elegibilidad 1',
              ),
            }),
          ]);
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
