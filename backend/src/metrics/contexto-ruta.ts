import { ultimoDiaDelMes } from '../prisma/timestamp.js';
import type { Database } from '../prisma/db.js';
import type { ContextoRutaDto } from './dto/contexto-ruta.dto.js';

export async function consultarContextoRuta(
  db: Database,
  { origenId, destinoId, periodo }: ContextoRutaDto,
) {
  const mes = periodo + '-01';
  const [actividad, indicadores] = await Promise.all([
    leerActividad(db, origenId, destinoId, mes),
    leerIndicadores(db, [origenId, destinoId], mes),
  ]);
  return { actividad: actividad?.despegues ? actividad : null, indicadores };
}

async function leerIndicadores(db: Database, ids: string[], mes: string) {
  const tablas = db.sql.public;
  const hasta = ultimoDiaDelMes(mes);
  const plan = tablas.aeropuertos
    .as('aeropuerto')
    .innerJoin(tablas.indicadores_externos.as('indicador'), (f, sql) =>
      sql.eq(f.aeropuerto.icao, f.indicador.entidad),
    )
    .innerJoin(tablas.indicadores_instantaneas.as('instantanea'), (f, sql) =>
      sql.eq(f.indicador.instantanea_id, f.instantanea.id),
    )
    .select((f) => ({
      id: f.aeropuerto.id,
      aeropuerto: f.indicador.entidad,
      desde: f.indicador.desde,
      hasta: f.indicador.hasta,
      valores: f.indicador.valores,
    }))
    .where((f, sql) =>
      sql.and(
        sql.in(f.aeropuerto.id, ids),
        sql.eq(f.aeropuerto.archivado_en, null),
        sql.eq(f.indicador.ambito, 'AIRPORT'),
        sql.eq(f.instantanea.publicada, true),
        sql.eq(f.instantanea.producto, 'stakeholder'),
        sql.in(f.indicador.granularidad, ['WK', 'DY']),
        sql.gte(f.indicador.desde, mes),
        sql.lte(f.indicador.hasta, hasta),
      ),
    )
    .orderBy('id')
    .orderBy((f) => f.instantanea.creado_en, { direction: 'desc' })
    .orderBy((f) => f.instantanea.id, { direction: 'desc' })
    .orderBy('hasta', { direction: 'desc' })
    .orderBy('desde')
    .build();
  const vistos = new Set<string>();
  const indicadores: {
    aeropuerto: string;
    desde: string;
    hasta: string;
    puntualidadLlegada: number;
  }[] = [];
  for await (const { id, aeropuerto, desde, hasta, valores } of db.query(
    plan,
  )) {
    if (
      vistos.has(id) ||
      !valores ||
      typeof valores !== 'object' ||
      !('ARR_PUN' in valores)
    )
      continue;
    const puntualidad = valores.ARR_PUN;
    if (typeof puntualidad !== 'number' && typeof puntualidad !== 'string')
      continue;
    vistos.add(id);
    indicadores.push({
      aeropuerto,
      desde,
      hasta,
      puntualidadLlegada: Number(puntualidad) * 100,
    });
    if (vistos.size === ids.length) break;
  }
  return indicadores;
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
