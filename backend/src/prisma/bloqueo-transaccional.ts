import type { Transaction } from './db.js';

export async function bloquearRecurso(
  tx: Transaction,
  recurso: 'catalogo' | 'metricas' | 'admisiones' | 'bts',
) {
  await tx.orm.public.BloqueoTransaccional.where({ recurso })
    .forUpdate()
    .firstOrThrow();
}

export async function bloquearMesAnac(tx: Transaction, periodo: string) {
  const recurso = `anac:${periodo}`;
  // El upsert adquiere el lock incluso en la primera publicación del mes.
  await tx.orm.public.BloqueoTransaccional.upsert({
    create: { recurso },
    update: { recurso },
  });
}
