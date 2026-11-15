import {
  ADAPTADOR_OAG,
  AdaptadorOag,
} from '../src/adapters/oag/adaptador-oag.js';
import { jest } from '@jest/globals';
import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { VuelosController } from '../src/vuelos/vuelos.controller.js';
import { VuelosService } from '../src/vuelos/vuelos.service.js';
import { OagController } from '../src/adapters/oag/oag.controller.js';
import { OagService } from '../src/adapters/oag/oag.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { MetricsService } from '../src/metrics/metrics.service.js';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';

describe('Ingesta OAG por administración y lectura pública del mapa', () => {
  const db = createDatabase();
  afterAll(() => db.close());

  it('publica una corrida paginada de forma idempotente y conserva la última publicación ante cuota agotada', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-13T12:00:00Z'));
    const rollback = new Error('rollback OAG');
    const claveAnterior = process.env.OAG_SUBSCRIPTION_KEY;
    process.env.OAG_SUBSCRIPTION_KEY = 'clave-sintetica-oag';
    let rol = 'ADMIN';
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    };
    const queue = new Queue(`oag-test-${randomUUID()}`, { connection });
    const events = new QueueEvents(queue.name, { connection });
    try {
      await db.transaction(async (tx) => {
        const [origen, destino] = await Promise.all(
          ['QZXZ', 'QZYZ'].map((icao) =>
            tx.orm.public.Aeropuerto.create({
              icao,
              nombre: icao,
              nombrePais: 'Argentina',
              latitud: 0,
              longitud: 0,
              ubicacion: ubicacionAeropuerto(0, 0),
            }),
          ),
        );
        const aerolinea = await tx.orm.public.Aerolinea.create({
          nombre: 'OAG ficticia',
          iata: null,
          icao: '8Z7',
        });
        let fallarTrasEscrituras = false;
        const module = await Test.createTestingModule({
          controllers: [OagController, MetricsController, VuelosController],
          providers: [
            { provide: ADAPTADOR_OAG, useClass: AdaptadorOag },
            OagService,
            MetricsService,
            VuelosService,
            { provide: getQueueToken('oag-queue'), useValue: queue },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  orm: tx.orm,
                  sql: tx.sql,
                  raw: tx.raw,
                  query: tx.query.bind(tx),
                  transaction: async <T>(
                    work: (inner: typeof tx) => Promise<T>,
                  ) => {
                    const ejecutarSql = (sql: ReturnType<typeof tx.raw.sql>) =>
                      tx.execute(sql.affectedCount().build());
                    await ejecutarSql(tx.raw.sql`SAVEPOINT publicacion_oag`);
                    try {
                      const resultado = await work(tx);
                      if (fallarTrasEscrituras) {
                        fallarTrasEscrituras = false;
                        throw new Error('Fallo simulado antes del commit');
                      }
                      return resultado;
                    } catch (error) {
                      await ejecutarSql(
                        tx.raw.sql`ROLLBACK TO SAVEPOINT publicacion_oag`,
                      );
                      throw error;
                    } finally {
                      await ejecutarSql(
                        tx.raw.sql`RELEASE SAVEPOINT publicacion_oag`,
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
        const worker = new Worker<{ ejecucionId: string }>(
          queue.name,
          (job) => app.get(OagService).importar(job.data.ejecucionId),
          { connection },
        );
        try {
          await events.waitUntilReady();
          const api = request(app.getHttpServer() as Server);
          const endpoint = '/administracion/oag';
          await api
            .post(endpoint + '/ejecutar')
            .send({})
            .expect(409);
          const config = {
            pausado: false,
            origenId: origen.id,
            destinoId: destino.id,
            periodo: '2026-10',
            coberturaMinimaPct: 50,
          };
          await api
            .patch(endpoint + '/configuracion')
            .send({ ...config, subscriptionKey: 'extra' })
            .expect(400);
          rol = 'OPERATOR';
          await api
            .patch(endpoint + '/configuracion')
            .send(config)
            .expect(403);
          rol = 'ADMIN';
          await api
            .patch(endpoint + '/configuracion')
            .send(config)
            .expect(200, config);

          const fila = (
            flightNumber: number,
            state: string,
            real?: string,
            utcDst?: string,
          ) => ({
            flightNumber,
            scheduleInstanceKey: `synthetic-${flightNumber}`,
            carrier: { icao: '8Z7' },
            departure: {
              airport: { icao: 'QZXZ' },
              date: utcDst
                ? { local: '2026-10-25', utc: '2026-10-25' }
                : { local: '2026-10-31', utc: '2026-11-01' },
              time: utcDst
                ? { local: '0230', utc: utcDst }
                : { local: '2300', utc: '0300' },
            },
            arrival: {
              airport: { icao: 'QZYZ' },
              date: { utc: '2026-11-01' },
              time: { utc: '0500' },
            },
            statusDetails: [
              {
                state,
                updatedAt: '2026-11-01T05:20:00Z',
                departure: real
                  ? { actualTime: { outGate: { utc: '2026-11-01T04:05:00Z' } } }
                  : undefined,
                arrival: { actualTime: { inGate: { utc: real } } },
              },
              ...(real ? [{ state, updatedAt: '2026-11-01T05:30:00Z' }] : []),
            ],
          });
          let sinCuota = false;
          let limiteTransitorio = false;
          let esperaLarga = false;
          let sinCobertura = false;
          let fallarAlPublicar = false;
          let paginaTruncada = false;
          let errorCredencial: number | undefined;
          const fetchOag = jest
            .spyOn(globalThis, 'fetch')
            .mockImplementation((input, options) => {
              const url = new URL(input instanceof Request ? input.url : input);
              expect(url.origin).toBe('https://api.oag.com');
              expect(
                new Headers(options?.headers).get('Subscription-Key'),
              ).toBe('clave-sintetica-oag');
              expect(url.searchParams.get('DepartureAirport')).toBe('QZXZ');
              if (errorCredencial)
                return Promise.resolve(
                  new Response(null, { status: errorCredencial }),
                );
              if (url.searchParams.has('After')) {
                if (esperaLarga)
                  return Promise.resolve(
                    new Response(null, {
                      status: 429,
                      headers: { 'Retry-After': '60' },
                    }),
                  );
                if (limiteTransitorio) {
                  limiteTransitorio = false;
                  return Promise.resolve(
                    new Response(null, {
                      status: 429,
                      headers: { 'Retry-After': '0' },
                    }),
                  );
                }
                if (sinCuota)
                  return Promise.resolve(new Response(null, { status: 429 }));
                fallarTrasEscrituras = fallarAlPublicar;
                return Promise.resolve(
                  Response.json({
                    data: [
                      fila(1, 'InGate', '2026-11-01T05:15:00Z'),
                      fila(3, 'Canceled', undefined, '0030'),
                      {
                        ...fila(4, 'InGate', undefined, '0130'),
                        statusDetails: [
                          {
                            state: 'InGate',
                            irregularOperationType: 'Diversion',
                          },
                        ],
                      },
                      fila(5, 'InGate'),
                      {
                        ...fila(6, 'InAir'),
                        statusDetails: [
                          { state: 'Diverted', diversionAirport: 'ABC' },
                        ],
                      },
                    ],
                  }),
                );
              }
              if (sinCobertura)
                return Promise.resolve(
                  Response.json({ data: [fila(6, 'Landed')] }),
                );
              if (paginaTruncada)
                return Promise.resolve(
                  Response.json({
                    data: [fila(1, 'InGate', '2026-11-01T05:15:00Z')],
                  }),
                );
              return Promise.resolve(
                Response.json({
                  data: [
                    {
                      ...fila(1, 'InGate'),
                      statusDetails: [
                        { state: 'InGate', updatedAt: '2026-11-01T05:45:00Z' },
                      ],
                    },
                    fila(2, 'InGate', '2026-11-01T05:15:01Z'),
                  ],
                  paging: {
                    next: 'https://api.oag.com/flight-instances/?After=pag2',
                  },
                }),
              );
            });
          const ejecutar = async (
            estado: string,
            fallo?: string,
            anterior?: string,
            autorizadas?: string[],
          ) => {
            const res = await api
              .post(
                anterior
                  ? `${endpoint}/ejecuciones/${anterior}/reintentar`
                  : endpoint + '/ejecutar',
              )
              .send(autorizadas ? { autorizarCambioFuente: autorizadas } : {})
              .expect(201);
            const { ejecucionId: id } = res.body as { ejecucionId: string };
            const job = await queue.getJob(id);
            expect(job?.data).toMatchObject({ ejecucionId: id });
            if (!job) throw new Error('No se encoló OAG');
            const trabajo = job.waitUntilFinished(events, 5000);
            if (fallo) await expect(trabajo).rejects.toThrow(fallo);
            else await trabajo;
            const historial = await api
              .get(endpoint + '/ejecuciones')
              .expect(200);
            expect(historial.body).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ id, estado, periodo: '2026-10' }),
              ]),
            );
            expect(historial.text).not.toContain('clave-sintetica-oag');
            return id;
          };
          const metrica = async () => {
            const res = await api
              .post('/metricas/mapa')
              .send({
                periodo: '2026-10',
                pares: [{ origenId: origen.id, destinoId: destino.id }],
              })
              .expect(200);
            return res.body as unknown;
          };
          await ejecutar('completed');
          expect(fetchOag).toHaveBeenCalledTimes(2);
          const operaciones = await api
            .get('/administracion/vuelos')
            .query({ fuente: 'OAG', origenId: origen.id, periodo: '2026-10' })
            .expect(200);
          expect(operaciones.body).toMatchObject({
            total: 5,
            datos: expect.arrayContaining([
              expect.objectContaining({
                numeroVuelo: '1',
                fechaVuelo: '2026-10-31',
                horarios: {
                  salidaProgramadaUtc: '2026-11-01T03:00:00.000Z',
                  salidaRealUtc: '2026-11-01T04:05:00.000Z',
                  llegadaProgramadaUtc: '2026-11-01T05:00:00.000Z',
                  llegadaRealUtc: '2026-11-01T05:15:00.000Z',
                  desfaseOrigenMinutos: -240,
                  evidenciaFecha: 'desfase-origen',
                },
              }),
              expect.objectContaining({
                estado: 'CANCELLED',
                fechaVuelo: '2026-10-25',
                horarios: expect.objectContaining({
                  salidaRealUtc: null,
                  llegadaRealUtc: null,
                  desfaseOrigenMinutos: 120,
                  salidaProgramadaUtc: '2026-10-25T00:30:00.000Z',
                }),
              }),
              expect.objectContaining({
                estado: 'DIVERTED',
                fechaVuelo: '2026-10-25',
                horarios: expect.objectContaining({
                  salidaRealUtc: null,
                  llegadaRealUtc: null,
                  desfaseOrigenMinutos: 60,
                  salidaProgramadaUtc: '2026-10-25T01:30:00.000Z',
                }),
              }),
            ]),
          });
          const esperado = [
            expect.objectContaining({
              otp15: 100 / 3,
              vuelosTotales: 5,
              vuelosSinEvidencia: 1,
              vuelosCancelados: 1,
              vuelosDesviados: 1,
              vuelosPuntuales: 1,
              fuentes: ['OAG'],
            }),
          ];
          expect(await metrica()).toEqual(esperado);
          limiteTransitorio = true;
          fetchOag.mockClear();
          await ejecutar('completed');
          expect(fetchOag).toHaveBeenCalledTimes(3);
          expect(fetchOag.mock.calls[2]?.[0]).toBe(fetchOag.mock.calls[1]?.[0]);
          expect(await metrica()).toEqual(esperado);
          esperaLarga = true;
          const diferida = await ejecutar('failed', 'Cuota de OAG agotada');
          await api
            .post(`${endpoint}/ejecuciones/${diferida}/reintentar`)
            .send({})
            .expect(409);
          esperaLarga = false;
          sinCuota = true;
          const agotada = await ejecutar('failed', 'Cuota de OAG agotada');
          expect(await metrica()).toEqual(esperado);
          sinCuota = false;
          fetchOag.mockClear();
          await ejecutar('completed', undefined, agotada);
          expect(fetchOag).toHaveBeenCalledTimes(1);
          expect(fetchOag.mock.calls[0]?.[0]).toEqual(
            expect.stringContaining('After=pag2'),
          );
          expect(await metrica()).toEqual(esperado);
          sinCobertura = true;
          await ejecutar('failed', 'Cobertura OAG insuficiente');
          expect(await metrica()).toEqual(esperado);
          for (const status of [401, 403]) {
            errorCredencial = status;
            fetchOag.mockClear();
            await ejecutar('failed', `OAG respondió HTTP ${status}`);
            expect(fetchOag).toHaveBeenCalledTimes(1);
            await api
              .post(endpoint + '/ejecutar')
              .send({})
              .expect(409);
            expect(await metrica()).toEqual(esperado);
            await api
              .patch(endpoint + '/configuracion')
              .send(config)
              .expect(200);
          }
          errorCredencial = undefined;
          sinCobertura = false;
          paginaTruncada = true;
          await ejecutar('failed', 'Cobertura OAG insuficiente');
          expect(await metrica()).toEqual(esperado);
          paginaTruncada = false;
          const bts = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'completed',
            iniciadoEn: '2026-11-01 00:00:00',
            finalizadoEn: '2026-11-01 00:00:01',
          });
          const poblacion = {
            origenId: origen.id,
            destinoId: destino.id,
            aerolineaId: aerolinea.id,
            periodo: '2026-10-01',
          };
          await tx.orm.public.MetricaRuta.where(poblacion).update({
            ejecucionEtlId: bts.id,
            fuentes: ['BTS'],
            vuelosPuntuales: 0,
          });
          const previa = await metrica();
          await ejecutar('failed', 'El cambio de fuente requiere autorización');
          expect(await metrica()).toEqual(previa);
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: bts.id,
          });
          fallarAlPublicar = true;
          await ejecutar(
            'failed',
            'No se pudo publicar la ejecución OAG',
            undefined,
            [aerolinea.id],
          );
          fallarAlPublicar = false;
          expect(await metrica()).toEqual(previa);
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: bts.id,
          });
          await tx.orm.public.MetricaRuta.where(poblacion).update({
            ejecucionEtlId: null,
          });
          await ejecutar('failed', 'El cambio de fuente requiere autorización');
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: null,
            fuentes: ['BTS'],
            vuelosPuntuales: 0,
          });
          const nueva = await ejecutar('completed', undefined, undefined, [
            aerolinea.id,
          ]);
          expect(await metrica()).toEqual(esperado);
          expect(
            await tx.orm.public.MetricaRuta.first(poblacion),
          ).toMatchObject({
            ejecucionEtlId: nueva,
          });
        } finally {
          await worker.close();
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await events.close();
      try {
        await queue.obliterate();
      } finally {
        await queue.close();
      }
      if (claveAnterior === undefined) delete process.env.OAG_SUBSCRIPTION_KEY;
      else process.env.OAG_SUBSCRIPTION_KEY = claveAnterior;
      jest.restoreAllMocks();
    }
  }, 15000);
});
