import { and, not } from '@prisma/orm-postgres/orm-client';
import type { Transaction } from '../prisma/db.js';
import { ultimoDiaDelMes } from '../prisma/timestamp.js';
import { admiteFuente } from './domain/autoridad-publicacion.js';
import { escribirPublicacion } from './publicacion.store.js';
import type { Poblacion } from './application/recalcular-pendientes.js';

type Clave = Omit<Poblacion, 'periodo'>;
type Tramo = Pick<Clave, 'origenId' | 'destinoId'>;

export async function publicarPoblacionesCandidatas(
  tx: Transaction,
  periodo: string,
  ejecucionId: string,
  fuente: string,
  autorizada: (clave: Clave) => boolean,
  tramo?: Tramo,
) {
  const { MetricaRuta } = tx.orm.public;
  const desde = periodo + '-01';
  const hasta = ultimoDiaDelMes(desde);
  const publicar = (clave: Clave) =>
    escribirPublicacion(tx, { ...clave, periodo }, { fuente, ejecucionId });

  let cursor: Clave = { origenId: '', destinoId: '', aerolineaId: '' };
  for (;;) {
    const candidatas = await tx.query(
      tx.sql.public.vuelos
        .select((v) => ({
          origenId: v.origen_id,
          destinoId: v.destino_id,
          aerolineaId: v.aerolinea_id,
        }))
        .where((v, sql) =>
          sql.and(
            sql.eq(v.ejecucion_etl_id, ejecucionId),
            sql.gte(v.fecha_vuelo, desde),
            sql.lte(v.fecha_vuelo, hasta),
            ...(tramo
              ? [
                  sql.eq(v.origen_id, tramo.origenId),
                  sql.eq(v.destino_id, tramo.destinoId),
                ]
              : []),
            sql.or(
              sql.gt(v.origen_id, cursor.origenId),
              sql.and(
                sql.eq(v.origen_id, cursor.origenId),
                sql.gt(v.destino_id, cursor.destinoId),
              ),
              sql.and(
                sql.eq(v.origen_id, cursor.origenId),
                sql.eq(v.destino_id, cursor.destinoId),
                sql.gt(v.aerolinea_id, cursor.aerolineaId),
              ),
            ),
          ),
        )
        .groupBy('origenId', 'destinoId', 'aerolineaId')
        .orderBy('origenId')
        .orderBy('destinoId')
        .orderBy('aerolineaId')
        .limit(100)
        .build(),
    );
    for (const clave of candidatas) {
      const actual = await MetricaRuta.where({ ...clave, periodo: desde })
        .select('ejecucionEtlId', 'actualizadoEn', 'vuelosTotales', 'fuentes')
        .include('ejecucionEtl', (e) => e.select('fuente'))
        .first();
      if (
        !actual ||
        admiteFuente(
          {
            ejecucionId: actual.ejecucionEtlId,
            actualizada: actual.actualizadoEn !== null,
            fuente: actual.ejecucionEtl?.fuente ?? null,
            vuelosTotales: actual.vuelosTotales,
            fuentes: actual.fuentes,
          },
          fuente,
          autorizada(clave),
        )
      )
        await publicar(clave);
    }
    if (candidatas.length < 100) break;
    cursor = candidatas[candidatas.length - 1];
  }

  // Una cobertura completa también sustituye poblaciones propias que quedaron vacías.
  const anteriores = MetricaRuta.where({
    periodo: desde,
    ...(tramo && { origenId: tramo.origenId, destinoId: tramo.destinoId }),
  })
    .where((m) =>
      and(
        m.ejecucionEtl.some({ fuente }),
        not(m.ejecucionEtlId.eq(ejecucionId)),
      ),
    )
    .select('origenId', 'destinoId', 'aerolineaId')
    .orderBy([
      (m) => m.origenId.asc(),
      (m) => m.destinoId.asc(),
      (m) => m.aerolineaId.asc(),
    ]);
  for (;;) {
    const ausentes = await anteriores.limit(100).all();
    for (const clave of ausentes) await publicar(clave);
    if (ausentes.length < 100) return;
  }
}
