import type { Database, Transaction } from '../prisma/db.js';

export async function conCantidadesRutas<T extends { id: string }>(
  db: Database | Transaction,
  rows: T[],
) {
  if (!rows.length) return [];
  const cantidades = await db.query(
    db.raw.sql`
      SELECT aeropuerto_id AS id, cantidad FROM cantidades_rutas_aeropuerto
      WHERE aeropuerto_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(rows.map(({ id }) => id))}::jsonb))
    `
      .returnsRow({ id: 'pg/text@1', cantidad: 'pg/int4@1' })
      .build(),
  );
  const porId = new Map(cantidades.map(({ id, cantidad }) => [id, cantidad]));
  return rows.map((row) => ({
    ...row,
    cantidadRutas: porId.get(row.id) ?? 0,
  }));
}
