import { createDatabase } from '../src/prisma/db.js';

describe('Internal catalog invariants (PostgreSQL)', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('rejects malformed catalog values and unnormalized emails from internal writers', async () => {
    const rollback = new Error('rollback invariant fixtures');
    try {
      await db.transaction(async (tx) => {
        const invalidWrites = [
          () => tx.orm.public.Pais.create({ nombre: '   ' }),
          () =>
            tx.orm.public.Pais.create({
              nombre: 'Invalid ISO fixture',
              codigoIso: 'invalid',
            }),
          () =>
            tx.orm.public.Aerolinea.create({
              nombre: 'Invalid IATA fixture',
              iata: 'TOOLONG',
            }),
          () =>
            tx.orm.public.Aeropuerto.create({
              nombre: 'Invalid ICAO fixture',
              nombrePais: 'Test',
              latitud: 0,
              longitud: 0,
              icao: 'bad',
            }),
          () =>
            tx.orm.public.Usuario.create({
              correo: ' USER@example.test ',
              hashContrasena: 'fixture',
            }),
          ...['\t', '\n', '\u00a0', '\u2007', '\u202f', '\ufeff'].map(
            (space) => () =>
              tx.orm.public.Usuario.create({
                correo: `${space}user@example.test${space}`,
                hashContrasena: 'fixture',
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
