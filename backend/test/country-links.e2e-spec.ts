import { createDatabase } from '../src/prisma/db.js';
import { linkCatalogCountries } from '../src/prisma/link-catalog-countries.js';

describe('Country link provenance (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('updates inferred links and preserves explicit ones after a country correction', async () => {
    const rollback = new Error('rollback country fixtures');
    try {
      await db.transaction(async (tx) => {
        const a = await tx.orm.public.Country.create({
          name: 'Country link fixture A',
        });
        const b = await tx.orm.public.Country.create({
          name: 'Country link fixture B',
        });
        const inferred = await tx.orm.public.Airport.create({
          name: 'Inferred fixture',
          countryName: a.name,
          latitude: 0,
          longitude: 0,
        });
        const explicit = await tx.orm.public.Airport.create({
          name: 'Explicit fixture',
          countryName: a.name,
          countryId: a.id,
          latitude: 1,
          longitude: 1,
        });
        const airline = await tx.orm.public.Airline.create({
          name: 'Inferred airline',
          country: a.name,
        });
        await linkCatalogCountries(tx);
        await tx.orm.public.Airport.where({ id: inferred.id }).update({
          countryName: b.name,
        });
        await tx.orm.public.Airport.where({ id: explicit.id }).update({
          countryName: b.name,
        });
        await tx.orm.public.Airline.where({ id: airline.id }).update({
          country: b.name,
        });
        await linkCatalogCountries(tx);
        expect(
          await tx.orm.public.Airport.first({ id: inferred.id }),
        ).toMatchObject({ countryId: b.id });
        expect(
          await tx.orm.public.Airline.first({ id: airline.id }),
        ).toMatchObject({ countryId: b.id });
        expect(
          await tx.orm.public.Airport.first({ id: explicit.id }),
        ).toMatchObject({ countryId: a.id });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
