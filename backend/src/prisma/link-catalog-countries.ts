import type { Database, Transaction } from './db.js';

// Preserve explicit links; only infer a missing country from an unambiguous name.
export async function linkCatalogCountries(db: Database | Transaction) {
  await db.execute(
    db.raw.sql`
    WITH matches AS (
      SELECT lower(btrim(name)) AS name, min(id) AS id
      FROM countries GROUP BY lower(btrim(name)) HAVING count(*) = 1
    )
    UPDATE airports a SET country_id = m.id FROM matches m
    WHERE a.country_id IS NULL AND lower(btrim(a.country_name)) = m.name
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
    UPDATE airlines a SET country_id = m.id FROM matches m
    WHERE a.country_id IS NULL AND lower(btrim(a.country)) = m.name
  `
      .affectedCount()
      .build(),
  );
}
