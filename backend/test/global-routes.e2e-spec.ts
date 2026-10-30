import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoutesService } from '../src/routes/routes.service.js';

describe('Global connections (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(async () => {
    await db.close();
  });

  it('filters before ranking unique pairs and keeps operators and return directions without persisting fixtures', async () => {
    const rollback = new Error('rollback global map fixtures');
    try {
      await db.transaction(async (tx) => {
        const service = new RoutesService({
          models: tx.orm.public,
          db: { raw: tx.raw, query: tx.query.bind(tx) },
        } as unknown as PrismaService);
        const tag = randomUUID();
        const ar = await tx.orm.public.Country.create({
          name: `test-ar-${tag}`,
          isoCode: 'AR',
        });
        const es = await tx.orm.public.Country.create({
          name: `test-es-${tag}`,
          isoCode: 'ES',
        });
        const unknown = await tx.orm.public.Country.create({
          name: `test-unknown-${tag}`,
          isoCode: 'XX',
        });
        async function airport(
          countryId: string,
          iata: string,
          routeCount: number,
        ) {
          return tx.orm.public.Airport.create({
            countryId,
            countryName: 'test',
            name: `${iata}-${tag}`,
            iata,
            latitude: 10,
            longitude: 20,
            routeCount,
          });
        }
        const origin = await airport(ar.id, 'AAA', 1_000_000);
        const internal = await airport(ar.id, 'AAB', 100);
        const unclassified = await airport(unknown.id, 'AAC', 1_000_000);
        const destinations: Awaited<ReturnType<typeof airport>>[] = [];
        for (let i = 0; i < 17; i++)
          destinations.push(
            await airport(es.id, `BA${String.fromCharCode(65 + i)}`, 100),
          );
        for (const destination of destinations.slice(0, 15)) {
          for (const airlineCode of ['T1', 'T2']) {
            await tx.orm.public.Route.create({
              originId: origin.id,
              destinationId: destination.id,
              airlineCode,
            });
          }
        }
        await tx.orm.public.Route.create({
          originId: destinations[0].id,
          destinationId: origin.id,
          airlineCode: 'RT',
        });
        // This pair has only a return; it must not qualify for Argentina → Spain.
        await tx.orm.public.Route.create({
          originId: destinations[15].id,
          destinationId: origin.id,
          airlineCode: 'RT',
        });
        await tx.orm.public.Route.create({
          originId: origin.id,
          destinationId: destinations[16].id,
          stops: 1,
        });
        await tx.orm.public.Route.create({
          originId: origin.id,
          destinationId: internal.id,
        });
        await tx.orm.public.Route.create({
          originId: unclassified.id,
          destinationId: destinations[0].id,
        });

        const filter = {
          mode: 'countries' as const,
          limit: 10,
          originCountryId: ar.id,
          destinationCountryId: es.id,
        };
        const top = await service.global(filter);
        expect(top).toHaveLength(10);
        expect(new Set(top.map((c) => c.id)).size).toBe(10);
        expect(
          top.every((c) => c.outbound.length === 2 && c.originId === origin.id),
        ).toBe(true);
        expect(top.map((c) => c.destinationId)).toEqual(
          [...top.map((c) => c.destinationId)].sort(),
        );
        expect((await service.global(filter)).map((c) => c.id)).toEqual(
          top.map((c) => c.id),
        );

        const all = await service.global({ ...filter, limit: 100 });
        expect(all).toHaveLength(15);
        expect(
          all.find((c) => c.destinationId === destinations[0].id)?.inbound,
        ).toHaveLength(1);
        expect(
          all.some(
            (c) =>
              c.destinationId === destinations[15].id ||
              c.destinationId === destinations[16].id,
          ),
        ).toBe(false);
        expect(
          await service.global({
            ...filter,
            originCountryId: es.id,
            destinationCountryId: ar.id,
            limit: 100,
          }),
        ).toHaveLength(2);

        const domestic = await service.global({
          mode: 'domestic',
          limit: 10,
          originCountryId: ar.id,
        });
        expect(domestic).toHaveLength(1);
        expect(domestic[0].originId).toBe(origin.id);
        expect(
          await service.global({
            mode: 'domestic',
            limit: 10,
            originCountryId: unknown.id,
          }),
        ).toEqual([]);
        const continental = await service.global({
          mode: 'continents',
          limit: 100,
          originContinent: 'SA',
          destinationContinent: 'EU',
        });
        expect(
          continental.filter((c) => c.originId === origin.id),
        ).toHaveLength(15);
        expect(continental.some((c) => c.originId === unclassified.id)).toBe(
          false,
        );
        const global = await service.global({ mode: 'global', limit: 50 });
        expect(
          global.some(
            (c) =>
              c.originId === unclassified.id ||
              c.destinationId === unclassified.id,
          ),
        ).toBe(true);
        const directed = await service.explore({
          originId: origin.id,
          destinationId: destinations[0].id,
          includeReturn: true,
        });
        expect(directed).toHaveLength(3);
        expect(directed.filter((r) => r.origin.id === origin.id)).toHaveLength(
          2,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 30000);
});
