import type { Database } from '../prisma/db.js';
import type { ContextoRutaDto } from './dto/contexto-ruta.dto.js';

export async function consultarContextoRuta(
  db: Database,
  { origenId, destinoId, periodo }: ContextoRutaDto,
) {
  const mes = periodo + '-01';
  const [actividad, indicadores] = await Promise.all([
    leerActividad(db, origenId, destinoId, mes),
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
  return { actividad: actividad?.despegues ? actividad : null, indicadores };
}

async function leerActividad(
  db: Database,
  origenId: string,
  destinoId: string,
  mes: string,
) {
  const tablas = db.sql.public;
  const plan = tablas.actividad_publicaciones
    .as('publicacion')
    .innerJoin(tablas.movimientos_aeropuerto.as('movimientos'), (f, sql) =>
      sql.eq(f.movimientos.revision_id, f.publicacion.revision_id),
    )
    .innerJoin(
      tablas.identidades_aeropuerto_fuente.as('identidadOrigen'),
      (f, sql) => sql.eq(f.identidadOrigen.identificador, f.movimientos.origen),
    )
    .innerJoin(
      tablas.identidades_aeropuerto_fuente.as('identidadDestino'),
      (f, sql) =>
        sql.eq(f.identidadDestino.identificador, f.movimientos.destino),
    )
    .select('despegues', (_f, sql) => sql.count())
    .select('pasajeros', (f, sql) => sql.sum(f.movimientos.pasajeros))
    .where((f, sql) =>
      sql.and(
        sql.eq(f.publicacion.periodo, mes),
        sql.eq(f.movimientos.movimiento, 'DESPEGUE'),
        sql.eq(f.identidadOrigen.fuente, 'ANAC'),
        sql.eq(f.identidadDestino.fuente, 'ANAC'),
        sql.eq(f.identidadOrigen.aeropuerto_id, origenId),
        sql.eq(f.identidadDestino.aeropuerto_id, destinoId),
      ),
    )
    .build();
  const [resumen] = await db.query(plan);
  return (
    resumen && {
      despegues: Number(resumen.despegues),
      pasajeros: resumen.pasajeros === null ? null : Number(resumen.pasajeros),
    }
  );
}
