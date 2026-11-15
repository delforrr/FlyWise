import { bloquearRecurso } from '../../prisma/bloqueo-transaccional.js';
import { ConflictException } from '@nestjs/common';
import type { Transaction } from '../../prisma/db.js';

export async function exigirIngestaDisponible(tx: Transaction) {
  // El lock serializa la admisión. La fila activa reserva el cupo tras el commit.
  await bloquearRecurso(tx, 'admisiones');
  const activa = await tx.orm.public.EjecucionEtl.where((fila) =>
    fila.fuente.in(['OAG', 'BTS']),
  )
    .where((fila) => fila.estado.in(['pending', 'running']))
    .orderBy((fila) => fila.id.asc())
    .first();
  if (activa) {
    throw new ConflictException({
      error: 'Conflict',
      message: 'Ya hay una ingesta de operaciones activa',
      ejecucionId: activa.id,
    });
  }
}
