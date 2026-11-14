import type { Database } from '../prisma/db.js';
import type { ContextoRutaDto } from './dto/contexto-ruta.dto.js';

export async function consultarContextoRuta(
  db: Database,
  { origenId, destinoId, periodo }: ContextoRutaDto,
) {
  const mes = periodo + '-01';
  const [actividad, indicadores] = await Promise.all([
    db.query(
      db.raw.sql`
        SELECT count(*)::int AS despegues, sum(m.pasajeros)::float8 AS pasajeros
        FROM actividad_publicaciones p
        JOIN movimientos_aeropuerto m ON m.revision_id=p.revision_id
        JOIN identidades_aeropuerto_fuente o ON o.fuente='ANAC' AND o.identificador=m.origen
        JOIN identidades_aeropuerto_fuente d ON d.fuente='ANAC' AND d.identificador=m.destino
        WHERE p.periodo=${mes}::date AND m.movimiento='DESPEGUE'
          AND o.aeropuerto_id=${origenId} AND d.aeropuerto_id=${destinoId}
        HAVING count(*) > 0
      `
        .returnsRow({
          despegues: 'pg/int4@1',
          pasajeros: { codecId: 'pg/float8@1', nullable: true },
        })
        .build(),
    ),
    db.query(
      db.raw.sql`
        SELECT DISTINCT ON (a.id) a.icao AS aeropuerto,
          i.desde::text AS desde, i.hasta::text AS hasta,
          ((i.valores->>'ARR_PUN')::numeric * 100)::float8 AS "puntualidadLlegada"
        FROM aeropuertos a
        JOIN indicadores_externos i ON i.entidad=a.icao AND i.ambito='AIRPORT'
        JOIN indicadores_instantaneas s ON s.id=i.instantanea_id
        WHERE a.id IN (${origenId},${destinoId}) AND a.archivado_en IS NULL
          AND s.publicada AND s.producto='stakeholder'
          AND i.granularidad IN ('WK','DY') AND i.valores->>'ARR_PUN' IS NOT NULL
          AND i.desde >= ${mes}::date AND i.hasta < ${mes}::date + interval '1 month'
        ORDER BY a.id, s.creado_en DESC, s.id DESC, i.hasta DESC, i.desde ASC
      `
        .returnsRow({
          aeropuerto: 'pg/text@1',
          desde: 'pg/text@1',
          hasta: 'pg/text@1',
          puntualidadLlegada: 'pg/float8@1',
        })
        .build(),
    ),
  ]);
  return { actividad: actividad[0] ?? null, indicadores };
}
