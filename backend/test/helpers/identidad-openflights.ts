import type { Database, Transaction } from '../../src/prisma/db.js';

export function aeropuertoOpenFlights(
  { orm }: Transaction | Database,
  id: number,
) {
  return orm.public.Aeropuerto.where((aeropuerto) =>
    aeropuerto.identidadesFuente.some({
      fuente: 'OpenFlights',
      identificador: String(id),
    }),
  );
}

export function asociarAeropuertoOpenFlights(
  { orm }: Transaction,
  id: number,
  aeropuertoId: string,
) {
  return orm.public.IdentidadAeropuertoFuente.create({
    fuente: 'OpenFlights',
    identificador: String(id),
    aeropuertoId,
    observacion: {},
  });
}
