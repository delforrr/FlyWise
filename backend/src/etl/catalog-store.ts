import { randomUUID } from 'node:crypto';
import type { Database, Transaction } from '../prisma/db.js';
import type { CatalogDataset, CatalogRecord } from './catalog.js';
import { reconcileOpenFlightsAirports } from './adapters/openflights-identities.js';

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
  if (dataset === 'paises') {
    const { Pais } = db.orm.public;
    const paises = [...unique.values()].map((row) => {
      if (typeof row.nombre !== 'string')
        throw new Error('nombre: obligatorio');
      return {
        id: row.id,
        nombre: row.nombre,
        codigoIso: typeof row.codigoIso === 'string' ? row.codigoIso : null,
        codigoIsoInvalid: row.codigoIsoInvalid === true,
      };
    });
    if (!paises.length) return { insertadas: 0, omitidas: 0 };

    const creados = await Pais.select('id').createAll(
      paises.map(({ id, nombre, codigoIso, codigoIsoInvalid }) => ({
        id,
        nombre,
        codigoIso: codigoIsoInvalid ? null : codigoIso,
      })),
      { onConflict: 'skip' },
    );
    const idsCreados = new Set(creados.map(({ id }) => id));
    const nombresPorIso = new Map<string | null, string[]>();
    for (const { id, nombre, codigoIso, codigoIsoInvalid } of paises) {
      if (idsCreados.has(id) || codigoIsoInvalid) continue;
      const nombres = nombresPorIso.get(codigoIso) ?? [];
      nombres.push(nombre);
      nombresPorIso.set(codigoIso, nombres);
    }
    for (const [codigoIso, nombres] of nombresPorIso)
      await Pais.where((pais) => pais.nombre.in(nombres)).updateAndCount({
        codigoIso,
      });
    return { insertadas: creados.length, omitidas: 0 };
  }
  const data = JSON.stringify([...unique.values()]);
  if (dataset === 'aeropuertos') await reconcileOpenFlightsAirports(db, data);
  const result = await guardarLote[dataset](db, data);
  return {
    insertadas: result.filter((row) => row.inserted).length,
    omitidas: unique.size - result.length,
  };
}

const guardarLote = {
  aeropuertos(db: StoreDatabase, data: string) {
    return db.query(
      db.raw.sql`
    WITH entrada AS (
      SELECT x.*,COALESCE(i.aeropuerto_id,x.id) AS entidad
      FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"idOpenflights" int,nombre text,ciudad text,"nombrePais" text,iata text,icao text,latitud float8,longitud float8,fuente text,"iataInvalid" boolean,"icaoInvalid" boolean)
      LEFT JOIN identidades_aeropuerto_fuente i ON i.fuente='OpenFlights' AND i.identificador=x."idOpenflights"::text
      WHERE i.identificador IS NULL OR i.aeropuerto_id IS NOT NULL
    ), cambios AS (
      INSERT INTO aeropuertos(id,nombre,ciudad,nombre_pais,iata,icao,latitud,longitud,ubicacion,fuente)
      SELECT x.entidad,x.nombre,x.ciudad,x."nombrePais",
        CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
        CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,
        x.latitud,x.longitud,ST_SetSRID(ST_MakePoint(x.longitud,x.latitud),4326)::geography,x.fuente
      FROM entrada x LEFT JOIN aeropuertos previous ON previous.id=x.entidad
      ON CONFLICT(id) DO UPDATE SET nombre=EXCLUDED.nombre,ciudad=EXCLUDED.ciudad,nombre_pais=EXCLUDED.nombre_pais,
        iata=EXCLUDED.iata,icao=EXCLUDED.icao,latitud=EXCLUDED.latitud,longitud=EXCLUDED.longitud,ubicacion=EXCLUDED.ubicacion,fuente=EXCLUDED.fuente
      WHERE NOT aeropuertos.protegido_manualmente AND aeropuertos.archivado_en IS NULL AND aeropuertos.fuente IS DISTINCT FROM 'OurAirports'
      RETURNING id,(xmax=0) AS inserted
    ), correspondencias AS (
      INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion)
      SELECT 'OpenFlights',x."idOpenflights"::text,x.entidad,to_jsonb(x)-ARRAY['id','entidad']
      FROM entrada x LEFT JOIN cambios c ON c.id=x.entidad
      WHERE c.id IS NOT NULL OR EXISTS (SELECT 1 FROM aeropuertos a WHERE a.id=x.entidad)
      ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion
    )
    SELECT inserted FROM cambios
`
        .returnsRow({ inserted: 'pg/bool@1' })
        .build(),
    );
  },
  aerolineas(db: StoreDatabase, data: string) {
    return db.query(
      db.raw.sql`
    WITH entrada AS (
      SELECT x.*,COALESCE(i.aerolinea_id,x.id) AS entidad
      FROM jsonb_to_recordset(${data}::jsonb) AS x(id text,"idOpenflights" int,nombre text,iata text,icao text,pais text,activa boolean,"iataInvalid" boolean,"icaoInvalid" boolean)
      LEFT JOIN identidades_aerolinea_fuente i ON i.fuente='OpenFlights' AND i.identificador=x."idOpenflights"::text
    ), cambios AS (
      INSERT INTO aerolineas(id,nombre,iata,icao,pais,activa)
      SELECT x.entidad,x.nombre,
        CASE WHEN x."iataInvalid" THEN previous.iata ELSE x.iata END,
        CASE WHEN x."icaoInvalid" THEN previous.icao ELSE x.icao END,x.pais,x.activa
      FROM entrada x LEFT JOIN aerolineas previous ON previous.id=x.entidad
      ON CONFLICT(id) DO UPDATE SET nombre=EXCLUDED.nombre,iata=EXCLUDED.iata,icao=EXCLUDED.icao,pais=EXCLUDED.pais,activa=EXCLUDED.activa
      WHERE NOT aerolineas.protegido_manualmente AND aerolineas.archivado_en IS NULL
      RETURNING id,(xmax=0) AS inserted
    ), correspondencias AS (
      INSERT INTO identidades_aerolinea_fuente(fuente,identificador,aerolinea_id,observacion)
      SELECT 'OpenFlights',x."idOpenflights"::text,x.entidad,to_jsonb(x)-ARRAY['id','entidad']
      FROM entrada x LEFT JOIN cambios c ON c.id=x.entidad
      WHERE c.id IS NOT NULL OR EXISTS (SELECT 1 FROM aerolineas a WHERE a.id=x.entidad)
      ON CONFLICT(fuente,identificador) DO UPDATE SET observacion=EXCLUDED.observacion
    )
    SELECT inserted FROM cambios
`
        .returnsRow({ inserted: 'pg/bool@1' })
        .build(),
    );
  },
  rutas(db: StoreDatabase, data: string) {
    return db.query(
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
  },
};

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
          WHEN oi.identificador IS NOT NULL AND oi.aeropuerto_id IS NULL
            THEN format('identidad pendiente de origen: %s',oi.identificador)
          WHEN di.identificador IS NOT NULL AND di.aeropuerto_id IS NULL
            THEN format('identidad pendiente de destino: %s',di.identificador)
          WHEN o.id IS NOT NULL AND oc.id IS NOT NULL AND o.id<>oc.id
            THEN format('coincidencia ambigua de origen: ID externo %s y código %s identifican aeropuertos distintos', x."idOpenflightsOrigen", x."codigoOrigen")
          WHEN d.id IS NOT NULL AND dc.id IS NOT NULL AND d.id<>dc.id
            THEN format('coincidencia ambigua de destino: ID externo %s y código %s identifican aeropuertos distintos', x."idOpenflightsDestino", x."codigoDestino")
        END AS "conflictoAeropuerto"
      FROM input x
      LEFT JOIN identidades_aeropuerto_fuente oi ON oi.fuente='OpenFlights' AND oi.identificador=x."idOpenflightsOrigen"::text
      LEFT JOIN aeropuertos o ON o.id=oi.aeropuerto_id
      LEFT JOIN identidades_aeropuerto_fuente di ON di.fuente='OpenFlights' AND di.identificador=x."idOpenflightsDestino"::text
      LEFT JOIN aeropuertos d ON d.id=di.aeropuerto_id
      LEFT JOIN identidades_aerolinea_fuente ai ON ai.fuente='OpenFlights' AND ai.identificador=x."idOpenflightsAerolinea"::text
      LEFT JOIN aerolineas a ON a.id=ai.aerolinea_id
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
