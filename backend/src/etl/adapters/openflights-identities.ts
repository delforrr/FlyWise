import type { Transaction, Database } from '../../prisma/db.js';

// Matching codes are candidates, not proof: conflicting country/ICAO stays pending.
export async function reconcileOpenFlightsAirports(
  db: Transaction | Database,
  input: string,
) {
  await db.execute(
    db.raw.sql`
    WITH entrada AS (
      SELECT * FROM jsonb_to_recordset(${input}::jsonb)
      AS x("idOpenflights" int,nombre text,"nombrePais" text,iata text,icao text,latitud float8,longitud float8)
    ) INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion)
    SELECT 'OpenFlights',x."idOpenflights"::text,NULL,to_jsonb(x)
    FROM entrada x CROSS JOIN LATERAL (
      SELECT count(*) AS cantidad,bool_and((a.icao IS NULL OR x.icao IS NULL OR a.icao=x.icao)
        AND a.nombre_pais=x."nombrePais" AND a.id_openflights IS NULL) AS compatible
      FROM aeropuertos a WHERE (x.icao IS NOT NULL AND a.icao=x.icao) OR (x.iata IS NOT NULL AND a.iata=x.iata)
    ) c WHERE NOT EXISTS (SELECT 1 FROM aeropuertos a WHERE a.id_openflights=x."idOpenflights")
      AND c.cantidad>0 AND (NOT (c.cantidad=1 AND c.compatible) OR EXISTS (
        SELECT 1 FROM entrada otra WHERE otra."idOpenflights"<>x."idOpenflights"
          AND ((x.icao IS NOT NULL AND otra.icao=x.icao) OR (x.iata IS NOT NULL AND otra.iata=x.iata))))
    ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion
  `
      .affectedCount()
      .build(),
  );
  await db.execute(
    db.raw.sql`
    WITH entrada AS (
      SELECT * FROM jsonb_to_recordset(${input}::jsonb) AS x("idOpenflights" int,"nombrePais" text,iata text,icao text)
    ), candidatas AS (
      SELECT x.*,c.id FROM entrada x CROSS JOIN LATERAL (
        SELECT min(a.id) AS id,count(*) AS cantidad,bool_and((a.icao IS NULL OR x.icao IS NULL OR a.icao=x.icao)
          AND a.nombre_pais=x."nombrePais" AND a.id_openflights IS NULL) AS compatible
        FROM aeropuertos a WHERE (x.icao IS NOT NULL AND a.icao=x.icao) OR (x.iata IS NOT NULL AND a.iata=x.iata)
      ) c WHERE c.cantidad=1 AND c.compatible
      AND NOT EXISTS (SELECT 1 FROM entrada otra WHERE otra."idOpenflights"<>x."idOpenflights"
        AND ((x.icao IS NOT NULL AND otra.icao=x.icao) OR (x.iata IS NOT NULL AND otra.iata=x.iata)))
      AND NOT EXISTS (SELECT 1 FROM aeropuertos a WHERE a.id_openflights=x."idOpenflights")
      AND NOT EXISTS (SELECT 1 FROM identidades_aeropuerto_fuente i WHERE i.fuente='OpenFlights'
        AND i.identificador=x."idOpenflights"::text AND i.aeropuerto_id IS NULL)
    ) UPDATE aeropuertos a SET id_openflights=c."idOpenflights" FROM candidatas c WHERE a.id=c.id
  `
      .affectedCount()
      .build(),
  );
}
