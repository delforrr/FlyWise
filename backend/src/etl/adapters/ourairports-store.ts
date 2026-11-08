import { randomUUID } from 'node:crypto';
import type { Transaction } from '../../prisma/db.js';
import type { CatalogDataset, CatalogRecord } from '../catalog.js';

// Each transaction processes one bounded batch, independently of catalogue size.
export async function storeOurAirportsBatch(
  tx: Transaction,
  dataset: CatalogDataset,
  rows: CatalogRecord[],
) {
  const input = JSON.stringify(
    rows.map((row) => ({ ...row, nuevoId: randomUUID() })),
  );
  if (dataset === 'paises') {
    const added = await tx.query(
      tx.raw.sql`
      INSERT INTO paises(id,nombre,codigo_iso)
      SELECT x."nuevoId",x.nombre,x."codigoIso"
      FROM jsonb_to_recordset(${input}::jsonb) AS x("nuevoId" text,nombre text,"codigoIso" text)
      WHERE NOT EXISTS (SELECT 1 FROM paises p WHERE p.codigo_iso=x."codigoIso")
      ON CONFLICT(nombre) DO UPDATE SET codigo_iso=EXCLUDED.codigo_iso WHERE paises.codigo_iso IS NULL
      RETURNING (xmax=0) AS inserted
    `
        .returnsRow({ inserted: 'pg/bool@1' })
        .build(),
    );
    return {
      insertadas: added.filter((row) => row.inserted).length,
      omitidas: rows.length - added.length,
    };
  }
  const [result] = await tx.query(
    tx.raw.sql`
    WITH entrada AS (
      SELECT x.*,to_jsonb(x)-'nuevoId' AS observacion FROM jsonb_to_recordset(${input}::jsonb)
      AS x("nuevoId" text,identificador text,nombre text,ciudad text,"codigoIso" text,latitud float8,longitud float8,iata text,icao text)
    ), resueltas AS (
      SELECT e.*,p.id AS pais_id,p.nombre AS nombre_pais,
        CASE WHEN previa.identificador IS NOT NULL THEN previa.aeropuerto_id
          WHEN cardinality(c.ids)=0 AND NOT conflicto.lote THEN e."nuevoId"
          WHEN cardinality(c.ids)=1 AND NOT conflicto.lote AND c.compatible
            AND NOT EXISTS (SELECT 1 FROM identidades_aeropuerto_fuente otra
              WHERE otra.fuente='OurAirports' AND otra.aeropuerto_id=c.ids[1] AND otra.identificador<>e.identificador)
            THEN c.ids[1] ELSE NULL END AS aeropuerto_id
      FROM entrada e
      LEFT JOIN paises p ON p.codigo_iso=e."codigoIso"
      LEFT JOIN identidades_aeropuerto_fuente previa ON previa.fuente='OurAirports' AND previa.identificador=e.identificador
      CROSS JOIN LATERAL (
        SELECT COALESCE(array_agg(a.id),ARRAY[]::text[]) AS ids,
          bool_and((a.icao IS NULL OR e.icao IS NULL OR a.icao=e.icao)
            AND (a.pais_id IS NULL OR a.pais_id=p.id)) AS compatible
        FROM aeropuertos a WHERE (e.icao IS NOT NULL AND a.icao=e.icao) OR (e.iata IS NOT NULL AND a.iata=e.iata)
      ) c
      CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM entrada otra WHERE otra.identificador<>e.identificador
        AND ((e.icao IS NOT NULL AND otra.icao=e.icao) OR (e.iata IS NOT NULL AND otra.iata=e.iata))) AS lote) conflicto
    ), nuevos AS (
      INSERT INTO aeropuertos(id,nombre,ciudad,nombre_pais,pais_id,iata,icao,latitud,longitud,ubicacion,fuente,cantidad_rutas)
      SELECT aeropuerto_id,nombre,ciudad,nombre_pais,pais_id,iata,icao,latitud,longitud,
        ST_SetSRID(ST_MakePoint(longitud,latitud),4326)::geography,'OurAirports',0
      FROM resueltas WHERE aeropuerto_id="nuevoId" AND pais_id IS NOT NULL
      RETURNING id
    ), identidades AS (
      INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion)
      SELECT 'OurAirports',r.identificador,r.aeropuerto_id,r.observacion FROM resueltas r
      LEFT JOIN nuevos n ON n.id=r.aeropuerto_id WHERE r.pais_id IS NOT NULL
      ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion
      RETURNING identificador
    ), actualizados AS (
      UPDATE aeropuertos a SET nombre=r.nombre,ciudad=r.ciudad,nombre_pais=r.nombre_pais,pais_id=r.pais_id,
        iata=COALESCE(r.iata,a.iata),icao=COALESCE(r.icao,a.icao),latitud=r.latitud,longitud=r.longitud,
        ubicacion=ST_SetSRID(ST_MakePoint(r.longitud,r.latitud),4326)::geography,fuente='OurAirports'
      FROM resueltas r WHERE a.id=r.aeropuerto_id AND r.pais_id IS NOT NULL
        AND NOT a.protegido_manualmente AND a.archivado_en IS NULL
      RETURNING a.id
    ) SELECT (SELECT count(*)::int FROM nuevos) AS insertadas,
      (SELECT count(*)::int FROM resueltas r LEFT JOIN aeropuertos a ON a.id=r.aeropuerto_id
        WHERE r.aeropuerto_id IS NULL OR a.protegido_manualmente OR a.archivado_en IS NOT NULL) AS omitidas,
      (SELECT count(*)::int FROM resueltas WHERE pais_id IS NULL) AS sin_pais
  `
      .returnsRow({
        insertadas: 'pg/int4@1',
        omitidas: 'pg/int4@1',
        sin_pais: 'pg/int4@1',
      })
      .build(),
  );
  if (result.sin_pais)
    throw new Error('Importar países OurAirports antes de aeropuertos');
  return { insertadas: result.insertadas, omitidas: result.omitidas };
}
