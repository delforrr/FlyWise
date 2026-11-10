import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { MetricsService } from '../src/metrics/metrics.service.js';

describe('Puntualidad del mapa por HTTP', () => {
  const db = createDatabase();
  afterAll(() => db.close());

  it('agrupa por ruta dirigida y operador sin confundir cero con ausencia', async () => {
    const rollback = new Error('rollback mapa');
    let app: INestApplication | undefined;
    try {
      await db.transaction(async (tx) => {
        const [origen, destino, sinDatos] = await Promise.all(
          ['Origen mapa', 'Destino mapa', 'Sin datos mapa'].map((nombre) =>
            tx.orm.public.Aeropuerto.create({
              nombre,
              nombrePais: 'Argentina',
              latitud: 0,
              longitud: 0,
              ubicacion: ubicacionAeropuerto(0, 0),
            }),
          ),
        );
        const [operador, otro] = await Promise.all(
          ['Operador mapa', 'Otro operador mapa'].map((nombre) =>
            tx.orm.public.Aerolinea.create({ nombre }),
          ),
        );
        const ida = { origenId: origen.id, destinoId: destino.id };
        const vuelta = { origenId: destino.id, destinoId: origen.id };
        const ausente = { origenId: origen.id, destinoId: sinDatos.id };
        const periodo = '2099-08-01';
        await tx.orm.public.MetricaRuta.create({
          ...ida,
          periodo,
          aerolineaId: operador.id,
          vuelosTotales: 11,
          vuelosCancelados: 1,
          vuelosPuntuales: 9,
          fuentes: ['BTS'],
          actualizadoEn: '2099-09-01 12:00:00',
          pendiente: true,
        });
        await tx.orm.public.MetricaRuta.create({
          ...ida,
          periodo,
          aerolineaId: otro.id,
          vuelosTotales: 2,
          vuelosPuntuales: 0,
          fuentes: ['Administrativa'],
          actualizadoEn: '2099-09-01 14:00:00',
        });
        await tx.orm.public.MetricaRuta.create({
          ...vuelta,
          periodo,
          aerolineaId: otro.id,
          vuelosTotales: 1,
          vuelosCancelados: 1,
          fuentes: ['Administrativa'],
        });
        await tx.orm.public.MetricaRuta.create({
          ...ida,
          periodo: '2099-09-01',
          aerolineaId: otro.id,
          vuelosTotales: 2,
          fuentes: ['Administrativa'],
        });
        const cargaBts = await tx.orm.public.EjecucionEtl.create({
          fuente: 'BTS',
          estado: 'completed',
          iniciadoEn: '2099-09-01 10:00:00',
          finalizadoEn: '2099-09-01 11:00:00',
        });
        await tx.execute(
          tx.raw.sql`
          INSERT INTO cobertura_bts(periodo, ejecucion_id, filas)
          VALUES (${'2099-08'}, ${cargaBts.id}, 1)
        `
            .affectedCount()
            .build(),
        );
        const module = await Test.createTestingModule({
          controllers: [MetricsController],
          providers: [
            MetricsService,
            {
              provide: PrismaService,
              useValue: { db: { raw: tx.raw, query: tx.query.bind(tx) } },
            },
          ],
        }).compile();
        app = module.createNestApplication();
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        );
        await app.init();
        const api = request(app.getHttpServer() as Server);
        const filtros = { periodo: '2099-08', pares: [ida, vuelta, ausente] };
        const combinadas = await api
          .post('/metricas/mapa')
          .send(filtros)
          .expect(200);
        expect(combinadas.body).toHaveLength(2);
        expect(combinadas.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...ida,
              periodo: '2099-08',
              otp15: 75,
              vuelosTotales: 13,
              vuelosOperados: 12,
              pendiente: true,
              actualizadoEn: '2099-09-01 12:00:00',
              fuentes: ['Administrativa', 'BTS'],
            }),
            expect.objectContaining({
              ...vuelta,
              otp15: null,
              vuelosOperados: 0,
            }),
          ]),
        );
        const filtradas = await api
          .post('/metricas/mapa')
          .send({ ...filtros, aerolineaId: otro.id })
          .expect(200);
        expect(filtradas.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ ...ida, otp15: 0, vuelosOperados: 2 }),
          ]),
        );
        await api
          .post('/metricas/mapa')
          .send({ ...filtros, pares: [{ ...ida, datoExtra: true }] })
          .expect(400);
        await api
          .post('/metricas/mapa')
          .send({ ...filtros, pares: [[ida]] })
          .expect(400);
        await api
          .post('/metricas/mapa')
          .send({ ...filtros, pares: Array.from({ length: 101 }, () => ida) })
          .expect(400);
        const opciones = await api.get('/metricas/mapa/opciones').expect(200);
        expect(opciones.body).toMatchObject({
          periodoInicial: '2099-08',
          periodos: expect.arrayContaining(['2099-09', '2099-08']),
          aerolineas: expect.arrayContaining([
            expect.objectContaining({
              id: operador.id,
              nombre: 'Operador mapa',
            }),
          ]),
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await app?.close();
    }
  });
});
