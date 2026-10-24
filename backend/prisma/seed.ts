import * as bcrypt from 'bcrypt';
import { createDatabase } from '../src/prisma/db.js';

// Los catálogos se importan mediante ETL; el seed solo crea el administrador inicial.
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 10) {
  throw new Error(
    'Define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 10 caracteres).',
  );
}
const db = createDatabase();
try {
  await db.connect();
  await db.orm.public.User.upsert({
    conflictOn: { email },
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'ADMIN',
    },
    update: {},
  });
} finally {
  await db.close();
}
