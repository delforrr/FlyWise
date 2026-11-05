import { createDatabase } from '../src/prisma/db.js';
import { linkCatalogCountries } from '../src/prisma/link-catalog-countries.js';

describe('Pais link provenance (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('updates inferred links and preserves explicit ones after a pais correction', async () => {
    const rollback = new Error('rollback pais fixtures');
    try {
      await db.transaction(async (tx) => {
        const a = await tx.orm.public.Pais.create({
          nombre: 'Pais link fixture A',
        });
        const b = await tx.orm.public.Pais.create({
          nombre: 'Pais link fixture B',
        });
        const inferred = await tx.orm.public.Aeropuerto.create({
          nombre: 'Inferred fixture',
          nombrePais: a.nombre,
          latitud: 0,
          longitud: 0,
        });
        const explicit = await tx.orm.public.Aeropuerto.create({
          nombre: 'Explicit fixture',
          nombrePais: a.nombre,
          paisId: a.id,
          latitud: 1,
          longitud: 1,
        });
        const aerolinea = await tx.orm.public.Aerolinea.create({
          nombre: 'Inferred aerolinea',
          pais: a.nombre,
        });
        await linkCatalogCountries(tx);
        await tx.orm.public.Aeropuerto.where({ id: inferred.id }).update({
          nombrePais: b.nombre,
        });
        await tx.orm.public.Aeropuerto.where({ id: explicit.id }).update({
          nombrePais: b.nombre,
        });
        await tx.orm.public.Aerolinea.where({ id: aerolinea.id }).update({
          pais: b.nombre,
        });
        await linkCatalogCountries(tx);
        expect(
          await tx.orm.public.Aeropuerto.first({ id: inferred.id }),
        ).toMatchObject({ paisId: b.id });
        expect(
          await tx.orm.public.Aerolinea.first({ id: aerolinea.id }),
        ).toMatchObject({ paisId: b.id });
        expect(
          await tx.orm.public.Aeropuerto.first({ id: explicit.id }),
        ).toMatchObject({ paisId: a.id });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
