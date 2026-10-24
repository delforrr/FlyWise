import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './generated/contract.d.js';
import contractJson from './generated/contract.json' with { type: 'json' };

// Jest loads JSON in another VM realm; normalize objects before Prisma validates them.
export const contract = contractFromJson<Contract>(
  JSON.parse(JSON.stringify(contractJson)),
);

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL es obligatoria');
  return postgres({ contract, url });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
