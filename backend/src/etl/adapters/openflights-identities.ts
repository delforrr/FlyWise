import type { Transaction, Database } from '../../prisma/db.js';

// Matching codes are candidates, not proof: conflicting country/ICAO stays pending.
export async function reconcileOpenFlightsAirports(
  db: Transaction | Database,
  input: string,
) {
  await db.execute(
    db.raw.sql`
      WITH entrada AS (
        SELECT e->>'idOpenflights' AS identificador,e->>'nombrePais' AS pais,
          e->>'iata' AS iata,e->>'icao' AS icao,e-'id' AS observacion
        FROM jsonb_array_elements(${input}::jsonb) e
      ), candidatas AS (
        SELECT x.*,c.id AS anterior,c.cantidad,c.compatible, EXISTS (
          SELECT 1 FROM entrada otra WHERE otra.identificador<>x.identificador
            AND ((x.icao IS NOT NULL AND otra.icao=x.icao) OR (x.iata IS NOT NULL AND otra.iata=x.iata))
        ) AS conflicto
        FROM entrada x CROSS JOIN LATERAL (
          SELECT min(a.id) AS id,count(*) AS cantidad,
            bool_and((a.icao IS NULL OR x.icao IS NULL OR a.icao=x.icao)
              AND a.nombre_pais=x.pais AND NOT EXISTS (
                SELECT 1 FROM identidades_aeropuerto_fuente i
                WHERE i.fuente='OpenFlights' AND i.aeropuerto_id=a.id
              )) AS compatible
          FROM aeropuertos a WHERE (x.icao IS NOT NULL AND a.icao=x.icao) OR (x.iata IS NOT NULL AND a.iata=x.iata)
        ) c
        WHERE NOT EXISTS (
          SELECT 1 FROM identidades_aeropuerto_fuente i
          WHERE i.fuente='OpenFlights' AND i.identificador=x.identificador
            AND i.aeropuerto_id IS NOT NULL
        )
      ), verificadas AS (
        SELECT *, count(*) OVER (PARTITION BY anterior) AS coincidencias
        FROM candidatas x WHERE cantidad>0 OR EXISTS (
          SELECT 1 FROM identidades_aeropuerto_fuente i
          WHERE i.fuente='OpenFlights' AND i.identificador=x.identificador
            AND i.aeropuerto_id IS NULL
        )
      )
      INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion)
      SELECT 'OpenFlights',x.identificador,
        CASE WHEN x.cantidad=1 AND x.compatible AND NOT x.conflicto AND x.coincidencias=1 THEN x.anterior END,
        x.observacion
      FROM verificadas x
      ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion
      WHERE identidades_aeropuerto_fuente.aeropuerto_id IS NULL
    `
      .affectedCount()
      .build(),
  );
}
