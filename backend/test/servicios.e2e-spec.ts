import { ConfiguracionOag } from '../src/adapters/oag/configuracion-oag.js';
import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { OagService } from '../src/adapters/oag/oag.service.js';
import { JwtAuthGuard } from '../src/auth/auth.guard.js';
import { BtsService } from '../src/bts/bts.service.js';
import { ADAPTADOR_BTS } from '../src/adapters/bts/adaptador-bts.js';
import { PipelineController } from '../src/etl/pipeline.controller.js';
import { PipelinesService } from '../src/etl/pipelines.service.js';
import { ServiciosOperacionesService } from '../src/etl/servicios-operaciones.service.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { VuelosService } from '../src/vuelos/vuelos.service.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { disposableDatabase } from './helpers/disposable-database.js';

describe('Servicios de operaciones', () => {
  const db = disposableDatabase();
  afterAll(() => db.close());

  it('valida proveedores, ejecuta BTS y conserva la historia al archivar', async () => {
    const rollback = new Error('rollback servicios');
    await expect(
      db.transaction(async (tx) => {
        const usuario = await tx.orm.public.Usuario.create({
          correo: 'servicios@flywise.test',
          hashContrasena: 'hash-fixture',
          rol: 'ADMIN',
        });
        const add = jest.fn();
        let rol = 'ADMIN';
        const modulo = await Test.createTestingModule({
          controllers: [PipelineController],
          providers: [
            ServiciosOperacionesService,
            PipelinesService,
            BtsService,
            VuelosService,
            { provide: OagService, useValue: {} },
            { provide: ConfiguracionOag, useValue: {} },
            { provide: ADAPTADOR_BTS, useValue: {} },
            {
              provide: getQueueToken('etl-queue'),
              useValue: {
                setGlobalConcurrency: jest.fn(),
                upsertJobScheduler: jest.fn(),
                removeJobScheduler: jest.fn(),
              },
            },
            {
              provide: getQueueToken('bts-queue'),
              useValue: {
                add,
                getJobScheduler: jest.fn(),
                setGlobalConcurrency: jest.fn(),
                upsertJobScheduler: jest.fn(),
                removeJobScheduler: jest.fn(),
              },
            },
            {
              provide: PrismaService,
              useValue: {
                models: tx.orm.public,
                db: {
                  transaction: (trabajo: (interior: typeof tx) => unknown) =>
                    trabajo(tx),
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
                .getRequest<{ user: { id: string; rol: string } }>().user = {
                id: usuario.id,
                rol,
              };
              return true;
            },
          })
          .compile();
        const app = modulo.createNestApplication();
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        app.useGlobalFilters(new HttpExceptionFilter());
        try {
          await app.init();
          const api = request(app.getHttpServer() as Server);
          const base = '/etl/procesos';
          const datos = {
            nombre: 'BTS mensual',
            proveedor: 'BTS',
            periodo: '2026-08',
          };
          const porDefecto = await api
            .post(base + '/operaciones')
            .send({ nombre: 'OAG sin tramo', periodo: datos.periodo })
            .expect(400);
          expect(porDefecto.body).toMatchObject({
            message: 'Seleccioná al menos un tramo',
          });
          await api
            .post(base + '/operaciones')
            .send({ ...datos, proveedor: 'externo' })
            .expect(400);
          await api
            .post(base + '/operaciones')
            .send({ ...datos, token: 'secreto' })
            .expect(400);
          const creada = await api
            .post(base + '/operaciones')
            .send(datos)
            .expect(201);
          expect(creada.body).toMatchObject({
            pausado: true,
            operacion: { proveedor: 'BTS' },
          });
          const { id } = creada.body as { id: string };
          const servicio = `${base}/${id}`;
          await api.post(`${servicio}/ejecutar`).send({}).expect(409);
          await api
            .patch(`${base}/operaciones/${id}`)
            .send({ ...datos, periodo: '2026-09', pausado: false })
            .expect(200);
          const [origen, destino] = await Promise.all(
            ['origen', 'destino'].map((nombre) =>
              tx.orm.public.Aeropuerto.create({
                nombre,
                nombrePais: 'Argentina',
                latitud: 0,
                longitud: 0,
                ubicacion: ubicacionAeropuerto(0, 0),
              }),
            ),
          );
          const operador = await tx.orm.public.Aerolinea.create({
            nombre: 'Operador histórico',
          });
          await tx.orm.public.MetricaRuta.create({
            origenId: origen.id,
            destinoId: destino.id,
            aerolineaId: operador.id,
            periodo: '2026-09-01',
            actualizadoEn: '2026-10-01 00:00:00',
            vuelosTotales: 1,
            fuentes: ['OAG', 'BTS'],
          });
          const cambios = await api
            .get(`${servicio}/cambios-de-fuente`)
            .expect(200);
          expect(cambios.body).toMatchObject([
            {
              aerolineaId: operador.id,
              fuentes: ['OAG', 'BTS'],
              ejecucionEtl: null,
            },
          ]);
          const corrida = await api
            .post(`${servicio}/ejecutar`)
            .send({})
            .expect(201);
          const { ejecucionId } = corrida.body as { ejecucionId: string };
          expect(add).toHaveBeenCalledWith(
            'mes',
            { ejecucionId, periodo: '2026-09' },
            expect.objectContaining({ jobId: ejecucionId }),
          );
          const conflicto = await api
            .post(`${servicio}/ejecutar`)
            .send({})
            .expect(409);
          expect(conflicto.body).toMatchObject({ ejecucionId });
          await tx.orm.public.EjecucionEtl.where({ id: ejecucionId }).update({
            estado: 'failed',
          });
          const reintento = await api
            .post(`/etl/ejecuciones/${ejecucionId}/reintentar`)
            .expect(201);
          await api.delete(servicio).expect(200);
          await api.get(servicio).expect(404);
          const historial = await api.get(`${servicio}/historial`).expect(200);
          expect(historial.body).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: ejecucionId, procesoId: id }),
              expect.objectContaining({
                id: (reintento.body as { ejecucionId: string }).ejecucionId,
                procesoId: id,
              }),
            ]),
          );
          rol = 'OPERATOR';
          await api.get(`${servicio}/historial`).expect(403);
        } finally {
          await app.close();
        }
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });
});
