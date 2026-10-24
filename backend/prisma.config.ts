import 'dotenv/config';
import { definePrismaConfig } from 'prisma/config';
import { defineConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  parent: false,
  orm: defineConfig({
    contract: 'prisma/contract.prisma',
    output: 'src/prisma/generated',
    migrations: { dir: 'prisma/migrations' },
    db: { connection: process.env.DATABASE_URL },
  }),
});
