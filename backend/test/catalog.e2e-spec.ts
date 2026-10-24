import { createDatabase, type Transaction } from '../src/prisma/db.js';
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
        const job = await tx.orm.public.EtlJob.create({
          source: 'all',
          status: 'running',
        });
        const results: Awaited<ReturnType<EtlService['importCatalog']>>[] = [];
        for (const target of [
          'countries',
          'airports',
          'airlines',
          'routes',
        ] as const) {
          results.push(
            await service.importCatalog(
              target,
              resolve('data', `${target}.dat`),
              job.id,
            ),
          );
        }
        expect(results.map((r) => r.total)).toEqual([261, 7698, 6162, 67663]);
        expect(results[1]).toMatchObject({ processed: 7698, discarded: 0 });
        expect(results[2]).toMatchObject({ processed: 6161, discarded: 1 });
        expect(results[3]).toMatchObject({ processed: 67091, discarded: 572 });
        const first = await tx.orm.public.EtlJob.firstOrThrow({ id: job.id });
        expect(first.totalRows).toBe(first.processedRows + first.discardedRows);
        const samples = await tx.orm.public.EtlDiscardedSample.where({
          jobId: job.id,
        }).all();
        expect(samples).toHaveLength(100);
        const missingCode = await tx.orm.public.Airport.where({
          iata: null,
        }).firstOrThrow();
        expect(missingCode.location).toBeDefined();
        const before = await tx.orm.public.Route.aggregate((a) => ({
          count: a.count(),
        }));
        const [unambiguous] = await tx.query(
          tx.raw.sql`
          SELECT r.id,r.airline_id AS "airlineId" FROM routes r WHERE r.airline_id IS NOT NULL AND r.airline_code IS NOT NULL
          AND (SELECT count(*) FROM airlines a WHERE a.iata=r.airline_code OR a.icao=r.airline_code)=1 LIMIT 1
        `
            .returnsRow({ id: 'pg/text@1', airlineId: 'pg/text@1' })
            .build(),
        );
        await tx.orm.public.Route.where({ id: unambiguous.id }).update({
          airlineId: null,
        });
        const repeated = await service.importCatalog(
          'routes',
          resolve('data/routes.dat'),
        );
        expect(repeated).toMatchObject({
          processed: 67091,
          inserted: 0,
          discarded: 572,
        });
        const after = await tx.orm.public.Route.aggregate((a) => ({
          count: a.count(),
        }));
        expect(after.count).toBe(before.count);
        expect(
          (await tx.orm.public.Route.firstOrThrow({ id: unambiguous.id }))
            .airlineId,
        ).toBe(unambiguous.airlineId);
        const route = await tx.orm.public.Route.firstOrThrow();
        const arcs = await new RoutesService(prisma).explore({
          originId: route.originId,
          destinationId: route.destinationId,
          limit: 10,
        });
        expect(
          arcs.every(
            (r) =>
              r.origin.id === route.originId &&
              r.destination.id === route.destinationId,
          ),
        ).toBe(true);
        expect(arcs[0]).toMatchObject({ otp15: null });
        expect(arcs[0]?.distanceKm).toBeGreaterThan(0);
        throw rollback;
      });
      throw new Error('Expected catalogue verification to rollback');
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 120000);
});
