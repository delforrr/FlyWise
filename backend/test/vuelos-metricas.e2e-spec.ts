import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { VuelosController } from '../src/vuelos/vuelos.controller.js';
import { VuelosService } from '../src/vuelos/vuelos.service.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { MetricsService } from '../src/metrics/metrics.service.js';
import { MetricsProcessor } from '../src/metrics/metrics.processor.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import type { Operacion } from '../src/vuelos/operacion.js';

function cuerpo<T>(respuesta: { body: unknown }): T {
  return respuesta.body as T;
}
type VueloHttp = { id: string; version: number; archivadoEn: string | null };
type PaginaHttp<T> = { datos: T[]; total: number };

describe('Operaciones y OTP mensual por HTTP', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('audita operaciones y publica OTP con observaciones, correcciones y recuperaciones', async () => {
    const rollback = new Error('rollback vuelos');
    try {
      await db.transaction(async (tx) => {
        const [origen, destino] = await Promise.all(
          ['Origen fixture 03', 'Destino fixture 03'].map((nombre) =>
            tx.orm.public.Aeropuerto.create({
              nombre,
              nombrePais: 'Argentina',
              latitud: 0,
              longitud: 0,
              ubicacion: ubicacionAeropuerto(0, 0),
            }),
          ),
        );
        const airline = await tx.orm.public.Aerolinea.create({
          nombre: 'Operador fixture 03',
        });
        const ruta = { origenId: origen.id, destinoId: destino.id };
        const base = {
          ...ruta,
          aerolineaId: airline.id,
          fechaVuelo: '2020-01-04',
          numeroVuelo: 'FW1',
          estado: 'ARRIVED' as const,
          demoraLlegadaMinutos: 15,
        };
        let rol = 'ADMIN';
        const module = await Test.createTestingModule({
          controllers: [VuelosController, MetricsController],
          providers: [
            VuelosService,
            MetricsService,
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
                .getRequest<{ user: { rol: string; id: string } }>().user = {
                rol,
                id: 'fixture-admin',
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
        const vuelos = '/administracion/vuelos';
        const metricas = '/metricas/rutas';
        const crear = (datos: Partial<Operacion>, codigo = 201) =>
          api
            .post(vuelos)
            .send({ ...base, ...datos })
            .expect(codigo);
        const consultar = async (periodo: string) =>
          cuerpo<PaginaHttp<unknown>>(
            await api
              .get(metricas)
              .query({ periodo, ...ruta })
              .expect(200),
          ).datos[0];
        const nombreCola = `metricas-test-${randomUUID()}`;
        const connection = {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        };
        const cola = new Queue(nombreCola, { connection });
        const eventos = new QueueEvents(nombreCola, { connection });
        const processor = new MetricsProcessor(
          module.get(MetricsService),
          cola,
        );
        const worker = new Worker(nombreCola, () => processor.process(), {
          connection,
        });
        const recalcular = async () => {
          const job = await cola.add('recalcular', {});
          await job.waitUntilFinished(eventos, 15000);
        };
        try {
          await eventos.waitUntilReady();
          const creado = await crear({});
          expect(creado.body).toMatchObject({
            fuente: 'Administrativa',
            ejecucionEtlId: null,
            version: 1,
            protegidoManualmente: true,
          });
          const path = `${vuelos}/${cuerpo<VueloHttp>(creado).id}`;
          expect((await api.get(path).expect(200)).body).toMatchObject({
            numeroVuelo: 'FW1',
            demoraLlegadaMinutos: 15,
          });
          expect(await consultar('2020-01')).toMatchObject({
            pendiente: true,
            actualizadoEn: null,
          });
          await recalcular();
          expect(await consultar('2020-01')).toMatchObject({
            vuelosTotales: 1,
            vuelosPuntuales: 1,
            otp15: 100,
            pendiente: false,
            fuentes: ['Administrativa'],
          });
          expect(
            (
              await api
                .get(metricas)
                .query({ periodo: '2020-01', ...ruta, pagina: 2 })
                .expect(200)
            ).body,
          ).toMatchObject({ datos: [], total: 1, pagina: 2 });
          await api
            .patch(path)
            .send({ version: 1, fechaVuelo: null })
            .expect(400);
          await api
            .patch(path)
            .send({ version: 1, demoraLlegadaMinutos: -8 })
            .expect(200);
          await api
            .patch(path)
            .send({ version: 1, demoraLlegadaMinutos: 0 })
            .expect(409);
          expect(
            (await api.get(`${path}/historial`).expect(200)).body,
          ).toMatchObject({
            datos: [
              {
                version: 2,
                accion: 'editar',
                actorId: 'fixture-admin',
                instantanea: { demoraLlegadaMinutos: -8 },
              },
              { version: 1, accion: 'crear' },
            ],
          });
          await api
            .patch(path)
            .send({ version: 2, fechaVuelo: '2020-02-01' })
            .expect(200);
          expect(await consultar('2020-01')).toMatchObject({
            vuelosTotales: 1,
            otp15: 100,
            pendiente: true,
          });
          expect(await consultar('2020-02')).toMatchObject({
            vuelosTotales: 0,
            otp15: null,
            pendiente: true,
          });
          await recalcular();
          expect(await consultar('2020-01')).toMatchObject({
            vuelosTotales: 0,
            otp15: null,
            pendiente: false,
          });
          expect(await consultar('2020-02')).toMatchObject({
            vuelosTotales: 1,
            otp15: 100,
            pendiente: false,
          });
          await api.post(`${path}/archivar`).send({ version: 3 }).expect(201);
          expect(
            (
              await api
                .get(vuelos)
                .query({ periodo: '2020-02', ...ruta })
                .expect(200)
            ).body,
          ).toMatchObject({ total: 0 });
          await recalcular();
          expect(await consultar('2020-02')).toMatchObject({
            vuelosTotales: 0,
            otp15: null,
          });
          await api.post(`${path}/restaurar`).send({ version: 4 }).expect(201);

          const job = await tx.orm.public.EjecucionEtl.create({
            fuente: 'BTS',
            estado: 'pending',
          });
          const observacion = {
            ...base,
            fuente: 'BTS',
            idRegistroFuente: 'fixture03',
            fechaVuelo: '2020-02-05',
            numeroVuelo: 'BTS1',
            demoraLlegadaMinutos: 16,
          };
          const importar = (demoraLlegadaMinutos: number) =>
            module
              .get(VuelosService)
              .importarLote([{ ...observacion, demoraLlegadaMinutos }], job.id);
          expect(await importar(16)).toEqual({ procesadas: 1, insertadas: 1 });
          const lista = cuerpo<PaginaHttp<VueloHttp>>(
            await api
              .get(vuelos)
              .query({ fuente: 'BTS', periodo: '2020-02', ...ruta })
              .expect(200),
          );
          expect(lista.total).toBe(1);
          const importado = `${vuelos}/${lista.datos[0].id}`;
          await api
            .patch(importado)
            .send({ version: 1, demoraLlegadaMinutos: 0 })
            .expect(200);
          expect(await importar(90)).toEqual({ procesadas: 1, insertadas: 0 });
          expect((await api.get(importado).expect(200)).body).toMatchObject({
            demoraLlegadaMinutos: 0,
            protegidoManualmente: true,
            ultimaObservacion: { demoraLlegadaMinutos: 90 },
          });
          await api
            .post(`${importado}/restablecer-fuente`)
            .send({ version: 3 })
            .expect(201);
          expect((await api.get(importado).expect(200)).body).toMatchObject({
            demoraLlegadaMinutos: 90,
            protegidoManualmente: false,
          });
          await recalcular();
          expect(await consultar('2020-02')).toMatchObject({
            vuelosTotales: 2,
            vuelosPuntuales: 1,
            otp15: 50,
            fuentes: ['Administrativa', 'BTS'],
          });
          await api
            .post(`${importado}/archivar`)
            .send({ version: 4 })
            .expect(201);
          await importar(20);
          expect(
            cuerpo<VueloHttp>(await api.get(importado).expect(200)).archivadoEn,
          ).not.toBeNull();
          await api
            .post(`${importado}/restablecer-fuente`)
            .send({ version: 6 })
            .expect(409);
          expect(
            cuerpo<PaginaHttp<unknown>>(
              await api.get(`${importado}/historial`).expect(200),
            ).datos[0],
          ).toMatchObject({
            version: 6,
            instantanea: { ultimaObservacion: { demoraLlegadaMinutos: 20 } },
          });

          const marzo = { fechaVuelo: '2020-03-01', numeroVuelo: 'FW3' };
          await api
            .post(vuelos)
            .send({
              ...ruta,
              aerolineaId: airline.id,
              ...marzo,
              estado: 'ARRIVED',
            })
            .expect(400);
          await crear(
            { ...marzo, estado: 'CANCELLED', demoraLlegadaMinutos: 10 },
            400,
          );
          await crear({ ...marzo, demoraLlegadaMinutos: 1.5 }, 400);
          await crear({ ...marzo, origenId: ruta.destinoId }, 400);
          await crear({ fechaVuelo: '2999-01-01' }, 400);
          await api
            .post(vuelos)
            .send({ ...base, estado: 'ACTIVE' })
            .expect(400);
          await api
            .post(vuelos)
            .send({ ...base, fuente: 'Falsa' })
            .expect(400);
          await crear({
            ...marzo,
            estado: 'CANCELLED',
            demoraLlegadaMinutos: null,
          });
          await recalcular();
          expect(await consultar('2020-03')).toMatchObject({
            vuelosTotales: 1,
            vuelosOperados: 0,
            otp15: null,
          });
          await crear({
            ...marzo,
            estado: 'DIVERTED',
            demoraLlegadaMinutos: null,
          });
          await recalcular();
          expect(await consultar('2020-03')).toMatchObject({
            vuelosTotales: 2,
            vuelosOperados: 1,
            vuelosDesviados: 1,
            otp15: 0,
          });
          await crear(marzo);
          const otra = await tx.orm.public.Aerolinea.create({
            nombre: 'Segundo operador fixture 03',
          });
          await module.get(VuelosService).importarLote(
            Array.from({ length: 8 }, (_, i) => ({
              ...observacion,
              fechaVuelo: marzo.fechaVuelo,
              idRegistroFuente: `fixture03-${i}`,
              aerolineaId: otra.id,
              demoraLlegadaMinutos: 0,
            })),
            job.id,
          );
          await module
            .get(MetricsService)
            .registrarError(new Error('Error de actualización fixture'));
          expect(await consultar('2020-03')).toMatchObject({
            pendiente: true,
            errorActualizacion: 'Error de actualización fixture',
          });
          await recalcular();
          expect(await consultar('2020-03')).toMatchObject({
            vuelosTotales: 11,
            vuelosOperados: 10,
            vuelosPuntuales: 9,
            otp15: 90,
            pendiente: false,
            errorActualizacion: null,
          });
          await api.get(vuelos).query({ limite: 101 }).expect(400);
          await api.get(metricas).query({ periodo: '2020-13' }).expect(400);
          for (const path of [metricas, vuelos])
            await api.get(path).query({ periodo: '0000-01' }).expect(400);
          await crear({
            fechaVuelo: '0024-02-29',
            estado: 'CANCELLED',
            demoraLlegadaMinutos: null,
          });
          expect(
            (
              await api
                .get(vuelos)
                .query({ periodo: '0024-02', ...ruta })
                .expect(200)
            ).body,
          ).toMatchObject({ total: 1, datos: [{ fechaVuelo: '0024-02-29' }] });
          rol = 'OPERATOR';
          await api.get(vuelos).expect(403);
          await crear({}, 403);
        } finally {
          await worker.close();
          await eventos.close();
          await cola.obliterate();
          await cola.close();
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 30000);
});
