import { jest } from '@jest/globals';
import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
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
        await tx.orm.public.Aerolinea.create({
          nombre: 'OAG ficticia',
          iata: null,
          icao: '8Z7',
        });
        const module = await Test.createTestingModule({
          controllers: [OagController, MetricsController],
          providers: [
            OagService,
            MetricsService,
            { provide: getQueueToken('oag-queue'), useValue: queue },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  raw: tx.raw,
                  query: tx.query.bind(tx),
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
            coberturaMinimaPct: 65,
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
          ) => ({
            flightNumber,
            scheduleInstanceKey: `synthetic-${flightNumber}`,
            carrier: { icao: '8Z7' },
            departure: {
              airport: { icao: 'QZXZ' },
              date: { local: '2026-10-10' },
              time: { local: '2300' },
            },
            arrival: {
              airport: { icao: 'QZYZ' },
              date: { utc: '2026-10-11' },
              time: { utc: '0000' },
            },
            statusDetails: [
              { state, arrival: { actualTime: { inGate: { utc: real } } } },
            ],
          });
          let sinCuota = false;
          let sinCobertura = false;
          const fetchOag = jest
            .spyOn(globalThis, 'fetch')
            .mockImplementation((input, options) => {
              const url = new URL(input instanceof Request ? input.url : input);
              expect(url.origin).toBe('https://api.oag.com');
              expect(
                new Headers(options?.headers).get('Subscription-Key'),
              ).toBe('clave-sintetica-oag');
              expect(url.searchParams.get('DepartureAirport')).toBe('QZXZ');
              if (url.searchParams.has('After')) {
                if (sinCuota)
                  return Promise.resolve(new Response(null, { status: 429 }));
                return Promise.resolve(
                  Response.json({
                    data: [
                      fila(1, 'InGate', '2026-10-11T00:15:00Z'),
                      fila(3, 'Canceled'),
                      fila(4, 'Diverted'),
                      fila(5, 'Landed'),
                    ],
                  }),
                );
              }
              if (sinCobertura)
                return Promise.resolve(
                  Response.json({ data: [fila(6, 'Landed')] }),
                );
              return Promise.resolve(
                Response.json({
                  data: [
                    fila(1, 'InGate', '2026-10-11T00:15:00Z'),
                    fila(2, 'InGate', '2026-10-11T00:15:01Z'),
                  ],
                  paging: {
                    next: 'https://api.oag.com/flight-instances/?After=pag2',
                  },
                }),
              );
            });
          const ejecutar = async (estado: string, fallo?: string) => {
            const res = await api
              .post(endpoint + '/ejecutar')
              .send({})
              .expect(201);
            const { ejecucionId: id } = res.body as { ejecucionId: string };
            const job = await queue.getJob(id);
            expect(job?.data).toEqual({ ejecucionId: id });
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
          const esperado = [
            expect.objectContaining({
              otp15: 100 / 3,
              vuelosTotales: 4,
              vuelosCancelados: 1,
              vuelosDesviados: 1,
              vuelosPuntuales: 1,
              fuentes: ['OAG'],
            }),
          ];
          expect(await metrica()).toEqual(esperado);
          await ejecutar('completed');
          expect(await metrica()).toEqual(esperado);
          sinCuota = true;
          await ejecutar('failed', 'Cuota de OAG agotada');
          expect(await metrica()).toEqual(esperado);
          sinCuota = false;
          sinCobertura = true;
          await ejecutar('failed', 'Cobertura OAG insuficiente');
          expect(await metrica()).toEqual(esperado);
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
