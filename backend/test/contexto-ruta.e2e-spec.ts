import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { ubicacionAeropuerto } from '../src/airports/ubicacion.js';
import { MetricsController } from '../src/metrics/metrics.controller.js';
import { MetricsService } from '../src/metrics/metrics.service.js';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Contexto público de una ruta', () => {
  const db = createDatabase();
  afterAll(() => db.close());

  it('devuelve despegues del tramo e indicadores del aeropuerto para el mes pedido', async () => {
    const rollback = new Error('rollback contexto');
    try {
      await db.transaction(async (tx) => {
        const origen = await tx.orm.public.Aeropuerto.create({
          nombre: 'Origen prueba',
          nombrePais: 'Argentina',
          latitud: 0,
          longitud: 0,
          ubicacion: ubicacionAeropuerto(0, 0),
        });
        const destino = await tx.orm.public.Aeropuerto.create({
          nombre: 'Destino prueba',
          nombrePais: 'Argentina',
          icao: 'ZZZZ',
          latitud: 0,
          longitud: 0,
          ubicacion: ubicacionAeropuerto(0, 0),
        });
        const periodo = '2026-10-01';
        const anac = await tx.orm.public.EjecucionEtl.create({
          fuente: 'ANAC',
          estado: 'completed',
          iniciadoEn: '2026-11-01 10:00:00',
          finalizadoEn: '2026-11-01 11:00:00',
        });
        const eurocontrol = await tx.orm.public.EjecucionEtl.create({
          fuente: 'EUROCONTROL:stakeholder',
          estado: 'completed',
          iniciadoEn: '2026-11-01 10:00:00',
          finalizadoEn: '2026-11-01 11:00:00',
        });
        await tx.orm.public.RevisionActividad.create({
          id: anac.id,
          periodo,
          uri: 'test',
          estado: 'publicada',
        });
        await tx.execute(
          tx.raw.sql`
          INSERT INTO actividad_publicaciones (periodo, revision_id)
          VALUES (${periodo}::date, ${anac.id})
          ON CONFLICT (periodo) DO UPDATE SET revision_id = EXCLUDED.revision_id
        `
            .affectedCount()
            .build(),
        );
        for (const [identificador, aeropuertoId] of [
          ['PRUEBA1', origen.id],
          ['PRUEBA2', destino.id],
        ]) {
          await tx.orm.public.IdentidadAeropuertoFuente.create({
            fuente: 'ANAC',
            identificador,
            aeropuertoId,
            observacion: {},
          });
        }
        for (const [numeroFila, movimiento, aeropuerto] of [
          [1, 'DESPEGUE', 'PRUEBA1'],
          [2, 'ATERRIZAJE', 'PRUEBA2'],
        ] as const) {
          await tx.orm.public.MovimientoAeropuerto.create({
            revisionId: anac.id,
            numeroFila,
            movimiento,
            aeropuerto,
            fechaUtc: '2026-10-10 12:00:00',
            origen: 'PRUEBA1',
            destino: 'PRUEBA2',
            operador: '',
            clase: '',
            clasificacion: '',
            calidad: '',
          });
        }
        await tx.orm.public.InstantaneaIndicador.create({
          id: eurocontrol.id,
          producto: 'stakeholder',
          ejecucionId: eurocontrol.id,
          checksum: '1'.repeat(64),
          uri: 'test',
          publicada: true,
        });
        await tx.orm.public.IndicadorExterno.create({
          instantaneaId: eurocontrol.id,
          ambito: 'AIRPORT',
          entidad: 'ZZZZ',
          nombre: 'Destino prueba',
          granularidad: 'WK',
          desde: '2026-10-14',
          hasta: '2026-10-20',
          valores: { ARR_PUN: 0.82 },
        });
        const module = await Test.createTestingModule({
          controllers: [MetricsController],
          providers: [
            MetricsService,
            {
              provide: PrismaService,
              useValue: {
                db: { sql: tx.sql, raw: tx.raw, query: tx.query.bind(tx) },
              },
            },
          ],
        }).compile();
        const app = module.createNestApplication();
        app.useGlobalPipes(
          new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
        );
        try {
          await app.init();
          const api = request(app.getHttpServer() as Server);
          const path = '/metricas/mapa/contexto';
          const query = {
            origenId: origen.id,
            destinoId: destino.id,
            periodo: '2026-10',
          };
          await api
            .get(path)
            .query(query)
            .expect(200, {
              actividad: { despegues: 1 },
              indicadores: [
                {
                  aeropuerto: 'ZZZZ',
                  desde: '2026-10-14',
                  hasta: '2026-10-20',
                  puntualidadLlegada: 82,
                },
              ],
            });
          await api
            .get(path)
            .query({ ...query, periodo: '2026-09' })
            .expect(200, { actividad: null, indicadores: [] });
          await api
            .get(path)
            .query({ ...query, origenId: destino.id, destinoId: origen.id })
            .expect(200)
            .expect(({ body }: { body: { actividad: unknown } }) =>
              expect(body.actividad).toBeNull(),
            );
          await api
            .get(path)
            .query({ ...query, origenId: 'inválido' })
            .expect(400);
        } finally {
          await app.close();
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
