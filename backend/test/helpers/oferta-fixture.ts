import type { CreateInput } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../../src/prisma/generated/contract.d.js';
import type { Transaction } from '../../src/prisma/db.js';

type OfertaFixture = Omit<
  CreateInput<Contract, 'OfertaRuta', 'public'>,
  'rutaId'
> & { origenId: string; destinoId: string };

export async function crearOfertaFixture(
  tx: Transaction,
  { origenId, destinoId, ...oferta }: OfertaFixture,
) {
  const ruta =
    (await tx.orm.public.Ruta.first({ origenId, destinoId })) ??
    (await tx.orm.public.Ruta.create({ origenId, destinoId }));
  return tx.orm.public.OfertaRuta.create({ ...oferta, rutaId: ruta.id });
}
