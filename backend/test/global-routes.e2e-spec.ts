import { crearOfertaFixture } from './helpers/oferta-fixture.js';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/prisma/db.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoutesService } from '../src/routes/routes.service.js';

describe('Global connections (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(async () => {
    await db.close();
  });

  it('filters before ranking unique pairs and keeps operadores and return directions without persisting fixtures', async () => {
    const rollback = new Error('rollback global map fixtures');
    try {
      await db.transaction(async (tx) => {
        const service = new RoutesService({
          models: tx.orm.public,
          db: { raw: tx.raw, query: tx.query.bind(tx) },
        } as unknown as PrismaService);
        const tag = randomUUID();
        const ar = await tx.orm.public.Pais.create({
          nombre: `test-ar-${tag}`,
          codigoIso: 'AR',
        });
        const es = await tx.orm.public.Pais.create({
          nombre: `test-es-${tag}`,
          codigoIso: 'ES',
        });
        const unknown = await tx.orm.public.Pais.create({
          nombre: `test-unknown-${tag}`,
          codigoIso: 'XX',
        });
        async function airport(
          paisId: string,
          iata: string,
          cantidadRutas: number,
        ) {
          return tx.orm.public.Aeropuerto.create({
            paisId,
            nombrePais: 'test',
            nombre: `${iata}-${tag}`,
            iata,
            latitud: 10,
            longitud: 20,
            cantidadRutas,
          });
        }
        const origen = await airport(ar.id, 'AAA', 1_000_000);
        const internal = await airport(ar.id, 'AAB', 100);
        const unclassified = await airport(unknown.id, 'AAC', 1_000_000);
        const destinations: Awaited<ReturnType<typeof airport>>[] = [];
        for (let i = 0; i < 17; i++)
          destinations.push(
            await airport(es.id, `BA${String.fromCharCode(65 + i)}`, 100),
          );
        for (const destino of destinations.slice(0, 15)) {
          for (const codigoAerolinea of ['T1', 'T2']) {
            await crearOfertaFixture(tx, {
              origenId: origen.id,
              destinoId: destino.id,
              codigoAerolinea,
            });
          }
        }
        await crearOfertaFixture(tx, {
          origenId: destinations[0].id,
          destinoId: origen.id,
          codigoAerolinea: 'RT',
        });
        // This pair has only a return; it must not qualify for Argentina → Spain.
        await crearOfertaFixture(tx, {
          origenId: destinations[15].id,
          destinoId: origen.id,
          codigoAerolinea: 'RT',
        });
        await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: destinations[16].id,
          escalas: 1,
        });
        await crearOfertaFixture(tx, {
          origenId: origen.id,
          destinoId: internal.id,
        });
        await crearOfertaFixture(tx, {
          origenId: unclassified.id,
          destinoId: destinations[0].id,
        });

        const filter = {
          mode: 'paises' as const,
          limit: 10,
          paisOrigenId: ar.id,
          paisDestinoId: es.id,
        };
        const top = await service.global(filter);
        expect(top).toHaveLength(10);
        expect(new Set(top.map((c) => c.id)).size).toBe(10);
        expect(
          top.every((c) => c.ida.length === 2 && c.origenId === origen.id),
        ).toBe(true);
        expect(top.map((c) => c.destinoId)).toEqual(
          [...top.map((c) => c.destinoId)].sort(),
        );
        expect((await service.global(filter)).map((c) => c.id)).toEqual(
          top.map((c) => c.id),
        );

        const all = await service.global({ ...filter, limit: 100 });
        expect(all).toHaveLength(15);
        expect(
          all.find((c) => c.destinoId === destinations[0].id)?.vuelta,
        ).toHaveLength(1);
        expect(
          all.some(
            (c) =>
              c.destinoId === destinations[15].id ||
              c.destinoId === destinations[16].id,
          ),
        ).toBe(false);
        expect(
          await service.global({
            ...filter,
            paisOrigenId: es.id,
            paisDestinoId: ar.id,
            limit: 100,
          }),
        ).toHaveLength(2);

        const domestic = await service.global({
          mode: 'domestic',
          limit: 10,
          paisOrigenId: ar.id,
        });
        expect(domestic).toHaveLength(1);
        expect(domestic[0].origenId).toBe(origen.id);
        expect(
          await service.global({
            mode: 'domestic',
            limit: 10,
            paisOrigenId: unknown.id,
          }),
        ).toEqual([]);
        const continental = await service.global({
          mode: 'continents',
          limit: 100,
          continenteOrigen: 'SA',
          continenteDestino: 'EU',
        });
        expect(
          continental.filter((c) => c.origenId === origen.id),
        ).toHaveLength(15);
        expect(continental.some((c) => c.origenId === unclassified.id)).toBe(
          false,
        );
        const global = await service.global({ mode: 'global', limit: 50 });
        expect(
          global.some(
            (c) =>
              c.origenId === unclassified.id || c.destinoId === unclassified.id,
          ),
        ).toBe(true);
        const directed = await service.explore({
          origenId: origen.id,
          destinoId: destinations[0].id,
          incluirRegreso: true,
        });
        expect(directed).toHaveLength(3);
        expect(directed.filter((r) => r.origen.id === origen.id)).toHaveLength(
          2,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }, 30000);
});
