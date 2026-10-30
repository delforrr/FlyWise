import { randomUUID } from 'node:crypto';
import type { Database, Transaction } from '../prisma/db.js';
import type { CatalogDataset, CatalogRecord } from './catalog.js';

type StoreDatabase = Database | Transaction;

// All table and column names below are fixed SQL; only row values are parameters.
export async function upsertCatalogBatch(
  db: StoreDatabase,
  dataset: CatalogDataset,
  rows: CatalogRecord[],
) {
  const unique = new Map(
    rows.map((row) => [
      JSON.stringify(
        dataset === 'countries'
          ? row.name
          : dataset === 'routes'
            ? [
                row.originId,
                row.destinationId,
                row.airlineId,
                row.airlineCode,
                row.codeshare,
                row.stops,
              ]
            : row.openflightsId,
      ),
      row,
    ]),
  );
  const data = JSON.stringify(
    [...unique.values()].map((row) => ({ ...row, id: randomUUID() })),
  );
  if (dataset === 'routes') {
    // Enrich a previously unresolved carrier before the offer's unique key changes.
    await db.execute(
      db.raw.sql`
      WITH input AS MATERIALIZED (
        SELECT * FROM jsonb_to_recordset(${data}::jsonb) AS x("originId" text,"destinationId" text,"airlineId" text,"airlineCode" text,codeshare boolean,stops int)
      ), unambiguous AS MATERIALIZED (
        SELECT codes.code FROM (SELECT DISTINCT "airlineCode" AS code FROM input WHERE "airlineId" IS NOT NULL) codes
        JOIN airlines a ON a.iata=codes.code OR a.icao=codes.code GROUP BY codes.code HAVING count(*)=1
      )
      UPDATE routes r SET airline_id=x."airlineId"
      FROM input x JOIN unambiguous u ON u.code=x."airlineCode"
      WHERE r.airline_id IS NULL AND x."airlineId" IS NOT NULL AND r.origin_id=x."originId"
        AND r.destination_id=x."destinationId" AND r.airline_code=x."airlineCode" AND r.codeshare=x.codeshare AND r.stops=x.stops
        AND NOT EXISTS (SELECT FROM routes known WHERE known.origin_id=r.origin_id AND known.destination_id=r.destination_id
          AND known.airline_id=x."airlineId" AND known.airline_code=r.airline_code AND known.codeshare=r.codeshare AND known.stops=r.stops)
    `
        .affectedCount()
        .build(),
    );
  }
  const result =
    dataset === 'countries'
      ? await db.query(
          db.raw.sql`
    INSERT INTO countries (id,name,iso_code)
    SELECT x.id,x.name,CASE WHEN x."isoCodeInvalid" THEN previous.iso_code ELSE x."isoCode" END
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,name text,"isoCode" text,"isoCodeInvalid" boolean)
    LEFT JOIN countries previous ON previous.name=x.name
    ON CONFLICT (name) DO UPDATE SET iso_code=EXCLUDED.iso_code
    RETURNING (xmax=0) AS inserted
  `
            .returnsRow({ inserted: 'pg/bool@1' })
            .build(),
        )
      : dataset === 'airports'
        ? await db.query(
            db.raw.sql`
    INSERT INTO airports (id,openflights_id,name,city,country_name,iata,icao,latitude,longitude,source,route_count)
    SELECT x.id,x."openflightsId",x.name,x.city,x."countryName",
      CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
      CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,x.latitude,x.longitude,x.source,0
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"openflightsId" int,name text,city text,"countryName" text,iata text,icao text,latitude float8,longitude float8,source text,"iataInvalid" boolean,"icaoInvalid" boolean)
    LEFT JOIN airports previous ON previous.openflights_id=x."openflightsId"
    ON CONFLICT (openflights_id) DO UPDATE SET name=EXCLUDED.name,city=EXCLUDED.city,country_name=EXCLUDED.country_name,
      iata=EXCLUDED.iata,icao=EXCLUDED.icao,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source=EXCLUDED.source
    RETURNING (xmax=0) AS inserted
  `
              .returnsRow({ inserted: 'pg/bool@1' })
              .build(),
          )
        : dataset === 'airlines'
          ? await db.query(
              db.raw.sql`
    INSERT INTO airlines (id,openflights_id,name,iata,icao,country,active)
    SELECT x.id,x."openflightsId",x.name,
      CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
      CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,x.country,x.active
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"openflightsId" int,name text,iata text,icao text,country text,active boolean,"iataInvalid" boolean,"icaoInvalid" boolean)
    LEFT JOIN airlines previous ON previous.openflights_id=x."openflightsId"
    ON CONFLICT (openflights_id) DO UPDATE SET name=EXCLUDED.name,iata=EXCLUDED.iata,icao=EXCLUDED.icao,country=EXCLUDED.country,active=EXCLUDED.active
    RETURNING (xmax=0) AS inserted
  `
                .returnsRow({ inserted: 'pg/bool@1' })
                .build(),
            )
          : await db.query(
              db.raw.sql`
    INSERT INTO routes (id,origin_id,destination_id,airline_id,airline_code,codeshare,stops)
    SELECT id,"originId","destinationId","airlineId","airlineCode",codeshare,stops
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"originId" text,"destinationId" text,"airlineId" text,"airlineCode" text,codeshare boolean,stops int)
    ON CONFLICT (origin_id,destination_id,airline_id,airline_code,codeshare,stops) DO UPDATE SET airline_code=EXCLUDED.airline_code
    RETURNING (xmax=0) AS inserted
  `
                .returnsRow({ inserted: 'pg/bool@1' })
                .build(),
            );
  return result.filter((row) => row.inserted).length;
}

export async function resolveRouteBatch(
  db: StoreDatabase,
  rows: CatalogRecord[],
) {
  const data = JSON.stringify(rows.map((row, index) => ({ ...row, index })));
  // Only references in this batch are queried. Codes are fallback keys only when unique.
  return db.query(
    db.raw.sql`
    WITH input AS (SELECT * FROM jsonb_to_recordset(${data}::jsonb) AS x(index int,"originOpenflightsId" int,"destinationOpenflightsId" int,"airlineOpenflightsId" int,"originCode" text,"destinationCode" text,"airlineCode" text))
    SELECT x.index,
      COALESCE(o.id,oc.id) AS "originId", COALESCE(d.id,dc.id) AS "destinationId", COALESCE(a.id,ac.id) AS "airlineId"
    FROM input x
    LEFT JOIN airports o ON o.openflights_id=x."originOpenflightsId"
    LEFT JOIN airports d ON d.openflights_id=x."destinationOpenflightsId"
    LEFT JOIN airlines a ON a.openflights_id=x."airlineOpenflightsId"
    LEFT JOIN LATERAL (SELECT min(id) id FROM airports WHERE iata=x."originCode" OR icao=x."originCode" HAVING count(*)=1) oc ON o.id IS NULL
    LEFT JOIN LATERAL (SELECT min(id) id FROM airports WHERE iata=x."destinationCode" OR icao=x."destinationCode" HAVING count(*)=1) dc ON d.id IS NULL
    LEFT JOIN LATERAL (SELECT min(id) id FROM airlines WHERE iata=x."airlineCode" OR icao=x."airlineCode" HAVING count(*)=1) ac ON a.id IS NULL
    ORDER BY x.index
  `
      .returnsRow({
        index: 'pg/int4@1',
        originId: { codecId: 'pg/text@1', nullable: true },
        destinationId: { codecId: 'pg/text@1', nullable: true },
        airlineId: { codecId: 'pg/text@1', nullable: true },
      })
      .build(),
  );
}
