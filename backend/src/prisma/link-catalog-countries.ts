import type { Database, Transaction } from './db.js';

// Preserve explicit links; refresh inferred links only from unambiguous names.
export async function linkCatalogCountries(db: Database | Transaction) {
  await db.execute(
    db.raw.sql`
    WITH matches AS (
      SELECT lower(btrim(name)) AS name, min(id) AS id
      FROM countries GROUP BY lower(btrim(name)) HAVING count(*) = 1
    )
    UPDATE airports a SET country_id = resolved.country_id, country_link_inferred = (resolved.country_id IS NOT NULL)
    FROM (SELECT a2.id, m.id AS country_id FROM airports a2 LEFT JOIN matches m ON lower(btrim(a2.country_name)) = m.name) resolved
    WHERE a.id = resolved.id AND (a.country_id IS NULL OR a.country_link_inferred)
      AND (a.country_id IS DISTINCT FROM resolved.country_id OR a.country_link_inferred IS DISTINCT FROM (resolved.country_id IS NOT NULL))
  `
      .affectedCount()
      .build(),
  );
  await db.execute(
    db.raw.sql`
    WITH matches AS (
      SELECT lower(btrim(name)) AS name, min(id) AS id
      FROM countries GROUP BY lower(btrim(name)) HAVING count(*) = 1
    )
    UPDATE airlines a SET country_id = resolved.country_id, country_link_inferred = (resolved.country_id IS NOT NULL)
    FROM (SELECT a2.id, m.id AS country_id FROM airlines a2 LEFT JOIN matches m ON lower(btrim(a2.country)) = m.name) resolved
    WHERE a.id = resolved.id AND (a.country_id IS NULL OR a.country_link_inferred)
      AND (a.country_id IS DISTINCT FROM resolved.country_id OR a.country_link_inferred IS DISTINCT FROM (resolved.country_id IS NOT NULL))
  `
      .affectedCount()
      .build(),
  );
}
