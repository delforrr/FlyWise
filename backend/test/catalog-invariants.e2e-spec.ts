import { createDatabase } from '../src/prisma/db.js';

describe('Internal catalog invariants (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('rejects malformed catalog values and unnormalized emails from internal writers', async () => {
    const rollback = new Error('rollback invariant fixtures');
    try {
      await db.transaction(async (tx) => {
        const invalidWrites = [
          () => tx.orm.public.Country.create({ name: '   ' }),
          () =>
            tx.orm.public.Country.create({
              name: 'Invalid ISO fixture',
              isoCode: 'invalid',
            }),
          () =>
            tx.orm.public.Airline.create({
              name: 'Invalid IATA fixture',
              iata: 'TOOLONG',
            }),
          () =>
            tx.orm.public.Airport.create({
              name: 'Invalid ICAO fixture',
              countryName: 'Test',
              latitude: 0,
              longitude: 0,
              icao: 'bad',
            }),
          () =>
            tx.orm.public.User.create({
              email: ' USER@example.test ',
              passwordHash: 'fixture',
            }),
          ...['\t', '\n', '\u00a0', '\u2007', '\u202f', '\ufeff'].map(
            (space) => () =>
              tx.orm.public.User.create({
                email: `${space}user@example.test${space}`,
                passwordHash: 'fixture',
              }),
          ),
        ];
        for (const write of invalidWrites) {
          await tx.execute(
            tx.raw.sql`SAVEPOINT invalid_catalog`.affectedCount().build(),
          );
          await expect(write()).rejects.toThrow(/check constraint/i);
          await tx.execute(
            tx.raw.sql`ROLLBACK TO SAVEPOINT invalid_catalog`
              .affectedCount()
              .build(),
          );
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
