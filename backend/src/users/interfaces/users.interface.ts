import type { CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import type { Database } from '../../prisma/db.js';

export type Usuario = CollectionRowOf<Database['orm']['public']['Usuario']>;
export type UserRole = Usuario['rol'];
