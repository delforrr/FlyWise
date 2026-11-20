import type { Transaction } from '../prisma/db.js';
import type { ObservacionVuelo } from '../entities/vuelos/domain/operacion.js';

export async function guardarObservaciones(
  tx: Transaction,
  observaciones: ObservacionVuelo[],
  ejecucionId: string,
) {
  const insertadas = await tx.orm.public.Vuelo.createAndCount(
    observaciones.map((vuelo) => ({ ...vuelo, ejecucionEtlId: ejecucionId })),
    { onConflict: 'skip' },
  );
  return { procesadas: observaciones.length, insertadas };
}
