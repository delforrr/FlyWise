import { createDatabase } from '../../src/prisma/db.js';

// These tests commit across connections; rollback cannot isolate their catalog imports.
export function disposableDatabase() {
  const url = process.env.FLYWISE_TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'FLYWISE_TEST_DATABASE_URL debe apuntar a una base descartable: estas pruebas modifican catálogos.',
    );
  }
  return createDatabase(url);
}
