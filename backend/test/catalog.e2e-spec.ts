import { createDatabase, type Transaction } from '../src/prisma/db.js';
import { OPENFLIGHTS_FILES } from '../src/etl/catalog.js';
import { EtlService } from '../src/etl/etl.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { Queue } from 'bullmq';
import { resolve } from 'node:path';
import { RoutesService } from '../src/routes/routes.service.js';

// Stream the real checked-in catalogues; rollback preserves the developer's database.
describe('OpenFlights complete import (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(async () => {
    await db.close();
  });
  it('recovers valid catalogues, explains residual discards and updates without duplicating nullable offers', async () => {
    const rollback = new Error('rollback catalogue verification');
    try {
      await db.transaction(async (tx) => {
        const database = {
          raw: tx.raw,
          query: tx.query.bind(tx),
          execute: tx.execute.bind(tx),
          transaction: async <T>(work: (inner: Transaction) => Promise<T>) =>
            work(tx),
        };
        const prisma = {
          models: tx.orm.public,
          db: database,
        } as unknown as PrismaService;
        const service = new EtlService({} as Queue, prisma);
        const job = await tx.orm.public.EjecucionEtl.create({
          fuente: 'all',
          estado: 'running',
        });
        const results: Awaited<ReturnType<EtlService['importCatalog']>>[] = [];
        for (const target of [
          'paises',
          'aeropuertos',
          'aerolineas',
          'rutas',
        ] as const) {
          results.push(
            await service.importCatalog(
              target,
              resolve('data', OPENFLIGHTS_FILES[target]),
              job.id,
            ),
          );
        }
        expect(results.map((r) => r.total)).toEqual([261, 7698, 6162, 67663]);
        expect(results[1]).toMatchObject({ processed: 7698, discarded: 0 });
        expect(results[2]).toMatchObject({ processed: 6161, discarded: 1 });
        expect(results[3]).toMatchObject({ processed: 66197, discarded: 1466 });
        const first = await tx.orm.public.EjecucionEtl.firstOrThrow({
          id: job.id,
        });
        expect(first.filasTotales).toBe(
          first.filasProcesadas + first.filasDescartadas,
        );
        const samples = await tx.orm.public.MuestraDescartadaEtl.where({
          ejecucionId: job.id,
        }).all();
        expect(samples).toHaveLength(100);
        expect(
          samples.some((sample) =>
            sample.motivo.includes('identifican aeropuertos distintos'),
          ),
        ).toBe(true);
        const missingCode = await tx.orm.public.Aeropuerto.where({
          iata: null,
        }).firstOrThrow();
        expect(missingCode.ubicacion).toBeDefined();
        const before = await tx.orm.public.OfertaRuta.aggregate((a) => ({
          count: a.count(),
        }));
        // Primera fila real de routes.dat: sus referencias son coherentes con el catálogo.
        const [unambiguous] = await tx.query(
          tx.raw.sql`
          SELECT o.id,o.aerolinea_id AS "aerolineaId" FROM ofertas_ruta o
          JOIN rutas r ON r.id=o.ruta_id
          JOIN aeropuertos origen ON origen.id=r.origen_id
          JOIN aeropuertos destino ON destino.id=r.destino_id
          JOIN aerolineas a ON a.id=o.aerolinea_id
          WHERE a.id_openflights=410 AND origen.id_openflights=2965 AND destino.id_openflights=2990
            AND o.codigo_aerolinea='2B' AND NOT o.codigo_compartido AND o.escalas=0
        `
            .returnsRow({ id: 'pg/text@1', aerolineaId: 'pg/text@1' })
            .build(),
        );
        await tx.orm.public.OfertaRuta.where({ id: unambiguous.id }).update({
          aerolineaId: null,
        });
        const candidatas = await tx.orm.public.OfertaRuta.orderBy((r) =>
          r.id.asc(),
        )
          .limit(2)
          .all();
        const protegida = candidatas.find((r) => r.id !== unambiguous.id)!;
        await tx.orm.public.OfertaRuta.where({ id: protegida.id }).update({
          escalas: 99,
          protegidoManualmente: true,
        });
        const repeated = await service.importCatalog(
          'rutas',
          resolve('data/routes.dat'),
        );
        expect(repeated).toMatchObject({
          processed: 66197,
          inserted: 0,
          discarded: 1466,
        });
        const after = await tx.orm.public.OfertaRuta.aggregate((a) => ({
          count: a.count(),
        }));
        const aeropuerto = await tx.orm.public.Aeropuerto.firstOrThrow({
          idOpenflights: 1,
        });
        const aerolinea = await tx.orm.public.Aerolinea.orderBy((a) =>
          a.id.asc(),
        ).firstOrThrow();
        await tx.orm.public.Aeropuerto.where({ id: aeropuerto.id }).update({
          nombre: 'Edición manual conservada',
          protegidoManualmente: true,
        });
        await tx.orm.public.Aerolinea.where({ id: aerolinea.id }).update({
          archivadoEn: '2026-10-30 00:00:00',
        });
        await service.importCatalog(
          'aeropuertos',
          resolve('data/airports.dat'),
        );
        await service.importCatalog('aerolineas', resolve('data/airlines.dat'));
        expect(
          await tx.orm.public.Aeropuerto.first({ id: aeropuerto.id }),
        ).toMatchObject({ nombre: 'Edición manual conservada' });
        expect(
          (await tx.orm.public.Aerolinea.firstOrThrow({ id: aerolinea.id }))
            .archivadoEn,
        ).not.toBeNull();
        await tx.orm.public.Aeropuerto.where({ id: aeropuerto.id }).update({
          protegidoManualmente: false,
        });
        await service.importCatalog(
          'aeropuertos',
          resolve('data/airports.dat'),
        );
        expect(
          await tx.orm.public.Aeropuerto.first({ id: aeropuerto.id }),
        ).toMatchObject({ nombre: aeropuerto.nombre });
        expect(after.count).toBe(before.count);
        expect(
          await tx.orm.public.OfertaRuta.first({ id: protegida.id }),
        ).toMatchObject({ escalas: 99, protegidoManualmente: true });
        expect(
          (await tx.orm.public.OfertaRuta.firstOrThrow({ id: unambiguous.id }))
            .aerolineaId,
        ).toBe(unambiguous.aerolineaId);
        const route = await tx.orm.public.Ruta.firstOrThrow();
        const arcs = await new RoutesService(prisma).explore({
          origenId: route.origenId,
          destinoId: route.destinoId,
          limit: 10,
        });
        expect(
          arcs.every(
            (r) =>
              r.origen.id === route.origenId &&
              r.destino.id === route.destinoId,
          ),
        ).toBe(true);
        expect(arcs[0]).toMatchObject({ otp15: null });
        expect(arcs[0]?.distanciaKm).toBeGreaterThan(0);
        throw rollback;
      });
      throw new Error('Expected catalogue verification to rollback');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 120000);
});
