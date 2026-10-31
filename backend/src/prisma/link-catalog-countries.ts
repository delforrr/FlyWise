import type { Database, Transaction } from './db.js';

// Preserve explicit links; refresh inferred links only from unambiguous names.
export async function linkCatalogCountries(db: Database | Transaction) {
  await db.execute(
    db.raw.sql`
    WITH matches AS (
      SELECT lower(btrim(nombre)) AS nombre, min(id) AS id
      FROM paises GROUP BY lower(btrim(nombre)) HAVING count(*) = 1
    )
    UPDATE aeropuertos a SET pais_id = resolved.pais_id, vinculo_pais_inferido = (resolved.pais_id IS NOT NULL)
    FROM (SELECT a2.id, m.id AS pais_id FROM aeropuertos a2 LEFT JOIN matches m ON lower(btrim(a2.nombre_pais)) = m.nombre) resolved
    WHERE a.id = resolved.id AND NOT a.protegido_manualmente AND a.archivado_en IS NULL AND (a.pais_id IS NULL OR a.vinculo_pais_inferido)
      AND (a.pais_id IS DISTINCT FROM resolved.pais_id OR a.vinculo_pais_inferido IS DISTINCT FROM (resolved.pais_id IS NOT NULL))
  `
      .affectedCount()
      .build(),
  );
  await db.execute(
    db.raw.sql`
    WITH matches AS (
      SELECT lower(btrim(nombre)) AS nombre, min(id) AS id
      FROM paises GROUP BY lower(btrim(nombre)) HAVING count(*) = 1
    )
    UPDATE aerolineas a SET pais_id = resolved.pais_id, vinculo_pais_inferido = (resolved.pais_id IS NOT NULL)
    FROM (SELECT a2.id, m.id AS pais_id FROM aerolineas a2 LEFT JOIN matches m ON lower(btrim(a2.pais)) = m.nombre) resolved
    WHERE a.id = resolved.id AND NOT a.protegido_manualmente AND a.archivado_en IS NULL AND (a.pais_id IS NULL OR a.vinculo_pais_inferido)
      AND (a.pais_id IS DISTINCT FROM resolved.pais_id OR a.vinculo_pais_inferido IS DISTINCT FROM (resolved.pais_id IS NOT NULL))
  `
      .affectedCount()
      .build(),
  );
}
