import type { CollectionRowOf } from '@prisma/orm-postgres/orm-client';
import type { Database } from '../../prisma/db.js';

export type User = CollectionRowOf<Database['orm']['public']['User']>;
export type UserRole = User['role'];
