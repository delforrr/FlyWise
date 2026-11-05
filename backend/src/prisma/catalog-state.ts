import type { Database, Transaction } from './db.js';

// The same PostgreSQL transaction lock orders ETL and administrative catalog writes.
export async function bloquearCatalogo(tx: Transaction) {
  await tx.execute(
    tx.raw.sql`SELECT pg_advisory_xact_lock(641024)`.affectedCount().build(),
  );
}

export async function recalcularCantidadRutas(db: Database | Transaction) {
  await db.execute(
    db.raw.sql`
    WITH visibles AS (
      SELECT DISTINCT r.origen_id, r.destino_id FROM rutas r
      JOIN aeropuertos o ON o.id=r.origen_id
      JOIN aeropuertos d ON d.id=r.destino_id
      JOIN ofertas_ruta f ON f.ruta_id=r.id
      LEFT JOIN aerolineas a ON a.id=f.aerolinea_id
      WHERE r.archivado_en IS NULL AND o.archivado_en IS NULL AND d.archivado_en IS NULL
        AND f.archivado_en IS NULL AND (f.aerolinea_id IS NULL OR a.archivado_en IS NULL)
    ), cantidades AS (
      SELECT aeropuerto_id, count(*)::int AS cantidad FROM (
        SELECT origen_id AS aeropuerto_id FROM visibles UNION ALL SELECT destino_id FROM visibles
      ) extremos GROUP BY aeropuerto_id
    )
    UPDATE aeropuertos a SET cantidad_rutas=COALESCE(c.cantidad,0)
    FROM (SELECT a2.id, cantidades.cantidad FROM aeropuertos a2 LEFT JOIN cantidades ON cantidades.aeropuerto_id=a2.id) c
    WHERE a.id=c.id AND a.cantidad_rutas IS DISTINCT FROM COALESCE(c.cantidad,0)
  `
      .affectedCount()
      .build(),
  );
}
