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

export type ServicioAdmitido = { id: string; actualizadoEn: string };

export async function exigirServicioDisponible(
  tx: Transaction,
  referencia: ServicioAdmitido,
) {
  const servicio = await tx.orm.public.ProcesoEtl.where({
    ...referencia,
    archivadoEn: null,
    pausado: false,
  })
    .select('id')
    .forUpdate()
    .first();
  if (!servicio)
    throw new ConflictException(
      'El servicio cambió. Volvé a cargar su configuración.',
    );
}
