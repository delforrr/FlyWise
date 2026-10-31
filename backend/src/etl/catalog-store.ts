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
  const ofertas = new Map<string, string>();
  const identificadas = rows.map((row): CatalogRecord & { id: string } => {
    const oferta = JSON.stringify([
      row.origenId,
      row.destinoId,
      row.aerolineaId,
      row.codigoAerolinea,
      row.codigoCompartido,
      row.escalas,
    ]);
    const id =
      typeof row.id === 'string'
        ? row.id
        : dataset === 'rutas'
          ? (ofertas.get(oferta) ?? randomUUID())
          : randomUUID();
    if (dataset === 'rutas') ofertas.set(oferta, id);
    return { ...row, id };
  });
  const unique = new Map(
    identificadas.map((row) => [
      dataset === 'paises'
        ? row.nombre
        : dataset === 'rutas'
          ? row.id
          : row.idOpenflights,
      row,
    ]),
  );
  const data = JSON.stringify([...unique.values()]);
  const result =
    dataset === 'paises'
      ? await db.query(
          db.raw.sql`
    INSERT INTO paises (id,nombre,codigo_iso)
    SELECT x.id,x.nombre,CASE WHEN x."codigoIsoInvalid" THEN previous.codigo_iso ELSE x."codigoIso" END
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,nombre text,"codigoIso" text,"codigoIsoInvalid" boolean)
    LEFT JOIN paises previous ON previous.nombre=x.nombre
    ON CONFLICT (nombre) DO UPDATE SET codigo_iso=EXCLUDED.codigo_iso
    RETURNING (xmax=0) AS inserted
  `
            .returnsRow({ inserted: 'pg/bool@1' })
            .build(),
        )
      : dataset === 'aeropuertos'
        ? await db.query(
            db.raw.sql`
    INSERT INTO aeropuertos (id,id_openflights,nombre,ciudad,nombre_pais,iata,icao,latitud,longitud,fuente,cantidad_rutas)
    SELECT x.id,x."idOpenflights",x.nombre,x.ciudad,x."nombrePais",
      CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
      CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,x.latitud,x.longitud,x.fuente,0
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"idOpenflights" int,nombre text,ciudad text,"nombrePais" text,iata text,icao text,latitud float8,longitud float8,fuente text,"iataInvalid" boolean,"icaoInvalid" boolean)
    LEFT JOIN aeropuertos previous ON previous.id_openflights=x."idOpenflights"
    ON CONFLICT (id_openflights) DO UPDATE SET nombre=EXCLUDED.nombre,ciudad=EXCLUDED.ciudad,nombre_pais=EXCLUDED.nombre_pais,
      iata=EXCLUDED.iata,icao=EXCLUDED.icao,latitud=EXCLUDED.latitud,longitud=EXCLUDED.longitud,fuente=EXCLUDED.fuente WHERE NOT aeropuertos.protegido_manualmente AND aeropuertos.archivado_en IS NULL
    RETURNING (xmax=0) AS inserted
  `
              .returnsRow({ inserted: 'pg/bool@1' })
              .build(),
          )
        : dataset === 'aerolineas'
          ? await db.query(
              db.raw.sql`
    INSERT INTO aerolineas (id,id_openflights,nombre,iata,icao,pais,activa)
    SELECT x.id,x."idOpenflights",x.nombre,
      CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
      CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,x.pais,x.activa
    FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"idOpenflights" int,nombre text,iata text,icao text,pais text,activa boolean,"iataInvalid" boolean,"icaoInvalid" boolean)
    LEFT JOIN aerolineas previous ON previous.id_openflights=x."idOpenflights"
    ON CONFLICT (id_openflights) DO UPDATE SET nombre=EXCLUDED.nombre,iata=EXCLUDED.iata,icao=EXCLUDED.icao,pais=EXCLUDED.pais,activa=EXCLUDED.activa WHERE NOT aerolineas.protegido_manualmente AND aerolineas.archivado_en IS NULL
    RETURNING (xmax=0) AS inserted
  `
                .returnsRow({ inserted: 'pg/bool@1' })
                .build(),
            )
          : await db.query(
              db.raw.sql`
    WITH entrada AS (
      SELECT * FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"origenId" text,"destinoId" text,"aerolineaId" text,"codigoAerolinea" text,"codigoCompartido" boolean,escalas int,"claveImportacion" text)
    ), nuevas_rutas AS (
      INSERT INTO rutas (id,origen_id,destino_id)
      SELECT gen_random_uuid()::text,x."origenId",x."destinoId" FROM entrada x
      WHERE NOT EXISTS (SELECT 1 FROM ofertas_ruta o WHERE o.id=x.id)
      GROUP BY x."origenId",x."destinoId"
      ON CONFLICT(origen_id,destino_id) DO NOTHING
      RETURNING id,origen_id,destino_id
    ), conexiones AS (
      SELECT id,origen_id,destino_id FROM nuevas_rutas
      UNION ALL SELECT id,origen_id,destino_id FROM rutas
    )
    INSERT INTO ofertas_ruta (id,ruta_id,aerolinea_id,codigo_aerolinea,codigo_compartido,escalas,clave_importacion)
    SELECT x.id,COALESCE(anterior.ruta_id,r.id),x."aerolineaId",x."codigoAerolinea",x."codigoCompartido",x.escalas,x."claveImportacion"
    FROM entrada x LEFT JOIN ofertas_ruta anterior ON anterior.id=x.id
    LEFT JOIN conexiones r ON r.origen_id=x."origenId" AND r.destino_id=x."destinoId"
    ON CONFLICT (id) DO UPDATE SET aerolinea_id=EXCLUDED.aerolinea_id,codigo_aerolinea=EXCLUDED.codigo_aerolinea,codigo_compartido=EXCLUDED.codigo_compartido,escalas=EXCLUDED.escalas WHERE NOT ofertas_ruta.protegido_manualmente AND ofertas_ruta.archivado_en IS NULL
    RETURNING (xmax=0) AS inserted
  `
                .returnsRow({ inserted: 'pg/bool@1' })
                .build(),
            );
  return {
    insertadas: result.filter((row) => row.inserted).length,
    omitidas: unique.size - result.length,
  };
}

export async function resolveRouteBatch(
  db: StoreDatabase,
  rows: CatalogRecord[],
) {
  const data = JSON.stringify(rows.map((row, index) => ({ ...row, index })));
  return db.query(
    db.raw.sql`
    WITH input AS (
      SELECT * FROM jsonb_to_recordset(${data}::jsonb) AS x(index int,"claveImportacion" text,"idOpenflightsOrigen" int,"idOpenflightsDestino" int,"idOpenflightsAerolinea" int,"codigoOrigen" text,"codigoDestino" text,"codigoAerolinea" text,"codigoCompartido" boolean,escalas int)
    ), resueltas AS (
      SELECT x.*, COALESCE(o.id,oc.id) AS "origenId", COALESCE(d.id,dc.id) AS "destinoId", COALESCE(a.id,ac.id) AS "aerolineaId",
        CASE
          WHEN o.id IS NOT NULL AND oc.id IS NOT NULL AND o.id<>oc.id
            THEN format('coincidencia ambigua de origen: ID externo %s y código %s identifican aeropuertos distintos', x."idOpenflightsOrigen", x."codigoOrigen")
          WHEN d.id IS NOT NULL AND dc.id IS NOT NULL AND d.id<>dc.id
            THEN format('coincidencia ambigua de destino: ID externo %s y código %s identifican aeropuertos distintos', x."idOpenflightsDestino", x."codigoDestino")
        END AS "conflictoAeropuerto"
      FROM input x
      LEFT JOIN aeropuertos o ON o.id_openflights=x."idOpenflightsOrigen"
      LEFT JOIN aeropuertos d ON d.id_openflights=x."idOpenflightsDestino"
      LEFT JOIN aerolineas a ON a.id_openflights=x."idOpenflightsAerolinea"
      LEFT JOIN LATERAL (SELECT min(id) id FROM aeropuertos WHERE iata=x."codigoOrigen" OR icao=x."codigoOrigen" HAVING count(*)=1) oc ON true
      LEFT JOIN LATERAL (SELECT min(id) id FROM aeropuertos WHERE iata=x."codigoDestino" OR icao=x."codigoDestino" HAVING count(*)=1) dc ON true
      LEFT JOIN LATERAL (SELECT min(id) id FROM aerolineas WHERE iata=x."codigoAerolinea" OR icao=x."codigoAerolinea" HAVING count(*)=1) ac ON a.id IS NULL
    )
    , referencias_aeropuertos AS (
      SELECT "idOpenflightsOrigen" AS id_externo, "origenId" AS aeropuerto_id FROM resueltas
      UNION ALL
      SELECT "idOpenflightsDestino", "destinoId" FROM resueltas
    ), ids_ambiguos AS (
      SELECT id_externo FROM referencias_aeropuertos WHERE id_externo IS NOT NULL
      GROUP BY id_externo HAVING count(DISTINCT aeropuerto_id)>1
    ), coincidencias AS (
      SELECT x.index, o.id AS oferta_id, r.origen_id AS origen_guardado, r.destino_id AS destino_guardado
      FROM resueltas x JOIN ofertas_ruta o ON o.clave_importacion=x."claveImportacion"
      JOIN rutas r ON r.id=o.ruta_id
    ), claves_ambiguas AS (
      SELECT "claveImportacion",
        CASE
          WHEN count(DISTINCT ROW("origenId"))>1 THEN 'coincidencia ambigua: misma clave de importación con aeropuertos de origen distintos'
          WHEN count(DISTINCT ROW("destinoId"))>1 THEN 'coincidencia ambigua: misma clave de importación con aeropuertos de destino distintos'
          WHEN count(DISTINCT ROW("aerolineaId"))>1 THEN 'coincidencia ambigua: misma clave de importación con aerolíneas distintas'
          ELSE 'coincidencia ambigua: misma clave de importación con códigos de aerolínea distintos'
        END AS motivo
      FROM resueltas GROUP BY "claveImportacion"
      HAVING count(DISTINCT ROW("origenId","destinoId","aerolineaId","codigoAerolinea"))>1
    ), contradicciones AS (
      SELECT "origenId","destinoId","aerolineaId","codigoAerolinea","codigoCompartido",escalas,
        count(DISTINCT "claveImportacion")>1 AS ambigua
      FROM resueltas GROUP BY "origenId","destinoId","aerolineaId","codigoAerolinea","codigoCompartido",escalas
    )
    SELECT x.index, x."origenId", x."destinoId", x."aerolineaId", c.oferta_id AS "ofertaId",
      CASE
        WHEN x."conflictoAeropuerto" IS NOT NULL THEN x."conflictoAeropuerto"
        WHEN ao.id_externo IS NOT NULL THEN format('coincidencia ambigua de origen: ID externo %s se asocia a aeropuertos distintos en el lote', ao.id_externo)
        WHEN ad.id_externo IS NOT NULL THEN format('coincidencia ambigua de destino: ID externo %s se asocia a aeropuertos distintos en el lote', ad.id_externo)
        WHEN k."claveImportacion" IS NOT NULL THEN k.motivo
        WHEN c.origen_guardado<>x."origenId" THEN 'coincidencia ambigua: misma clave de importación con origen distinto a la oferta existente'
        WHEN c.destino_guardado<>x."destinoId" THEN 'coincidencia ambigua: misma clave de importación con destino distinto a la oferta existente'
        WHEN COALESCE(g.ambigua,false) THEN 'coincidencia ambigua: claves de importación distintas para una oferta equivalente en el lote'
        WHEN EXISTS (
        SELECT 1 FROM ofertas_ruta r
        WHERE r.ruta_id=COALESCE(
          (SELECT reconocida.ruta_id FROM ofertas_ruta reconocida WHERE reconocida.id=c.oferta_id),
          (SELECT conexion.id FROM rutas conexion WHERE conexion.origen_id=x."origenId" AND conexion.destino_id=x."destinoId")
        )
          AND r.aerolinea_id IS NOT DISTINCT FROM x."aerolineaId" AND r.codigo_aerolinea IS NOT DISTINCT FROM x."codigoAerolinea"
          AND r.codigo_compartido=x."codigoCompartido" AND r.escalas=x.escalas AND r.id IS DISTINCT FROM c.oferta_id
      ) THEN 'coincidencia ambigua: ya existe otra oferta equivalente en la ruta'
      END AS motivo
    FROM resueltas x
    LEFT JOIN coincidencias c ON c.index=x.index
    LEFT JOIN ids_ambiguos ao ON ao.id_externo=x."idOpenflightsOrigen"
    LEFT JOIN ids_ambiguos ad ON ad.id_externo=x."idOpenflightsDestino"
    LEFT JOIN claves_ambiguas k ON k."claveImportacion"=x."claveImportacion"
    LEFT JOIN contradicciones g ON g."origenId" IS NOT DISTINCT FROM x."origenId" AND g."destinoId" IS NOT DISTINCT FROM x."destinoId"
      AND g."aerolineaId" IS NOT DISTINCT FROM x."aerolineaId" AND g."codigoAerolinea" IS NOT DISTINCT FROM x."codigoAerolinea"
      AND g."codigoCompartido"=x."codigoCompartido" AND g.escalas=x.escalas
    ORDER BY x.index
  `
      .returnsRow({
        index: 'pg/int4@1',
        origenId: { codecId: 'pg/text@1', nullable: true },
        destinoId: { codecId: 'pg/text@1', nullable: true },
        aerolineaId: { codecId: 'pg/text@1', nullable: true },
        ofertaId: { codecId: 'pg/text@1', nullable: true },
        motivo: { codecId: 'pg/text@1', nullable: true },
      })
      .build(),
  );
}
