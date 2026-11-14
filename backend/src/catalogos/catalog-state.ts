import { errorCatalogo } from '../prisma/catalog-error.js';
import type { Database, Transaction } from '../prisma/db.js';

// The same PostgreSQL transaction lock orders ETL and administrative catalog writes.
export async function bloquearCatalogo(tx: Transaction) {
  await tx.execute(
    tx.raw.sql`SELECT pg_advisory_xact_lock(641024)`.affectedCount().build(),
  );
}

export function escribirCatalogo<T>(
  db: Database,
  trabajo: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db
    .transaction(async (tx) => {
      await bloquearCatalogo(tx);
      return trabajo(tx);
    })
    .catch(errorCatalogo);
}

export function proteccionManual(
  cambios: object,
  solicitada: boolean | undefined,
  actual: boolean,
) {
  return Object.keys(cambios).length > 0 ? true : (solicitada ?? actual);
}
