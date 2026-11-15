import { and, or } from '@prisma/orm-postgres/orm-client';
import type { Transaction } from '../prisma/db.js';
import { ultimoDiaDelMes } from '../prisma/timestamp.js';
import { archivarObservaciones } from '../vuelos/observaciones.store.js';

// La publicación ya tiene el bloqueo de cambios de operaciones de importarLote.
export async function retirarAusentesBts(
  tx: Transaction,
  periodo: string,
  ejecucionId: string,
) {
  const inicio = periodo + '-01';
  const hasta = ultimoDiaDelMes(inicio);
  const archivadoEn = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const tablas = tx.sql.public;
  const ausentes = tablas.vuelos
    .as('vuelo')
    .outerLeftJoin(tablas.preparacion_bts.as('preparada'), (f, sql) =>
      sql.and(
        sql.eq(f.preparada.ejecucion_id, ejecucionId),
        sql.eq(f.preparada.identidad, f.vuelo.id_registro_fuente),
      ),
    )
    .select((f) => ({ id: f.vuelo.id, version: f.vuelo.version }))
    .where((f, sql) =>
      sql.and(
        sql.eq(f.vuelo.fuente, 'BTS'),
        sql.eq(f.vuelo.protegido_manualmente, false),
        sql.eq(f.vuelo.archivado_en, null),
        sql.gte(f.vuelo.fecha_vuelo, inicio),
        sql.lte(f.vuelo.fecha_vuelo, hasta),
        sql.eq(f.preparada.identidad, null),
      ),
    )
    .orderBy('id')
    .limit(100)
    .forUpdate({ of: ['vuelo'] })
    .build();

  const { MetricaRuta } = tx.orm.public;
  for (;;) {
    const lote = await tx.query(ausentes);
    if (!lote.length) return;
    const retiradas = await archivarObservaciones(
      tx,
      lote,
      ejecucionId,
      archivadoEn,
    );
    const poblaciones = new Map(
      retiradas.map(({ origenId, destinoId, aerolineaId }) => [
        JSON.stringify([origenId, destinoId, aerolineaId]),
        { origenId, destinoId, aerolineaId },
      ]),
    );
    const claves = [...poblaciones.values()];
    await MetricaRuta.createAndCount(
      claves.map((clave) => ({
        ...clave,
        periodo: inicio,
        vuelosTotales: 0,
        pendiente: true,
      })),
      { onConflict: 'skip' },
    );
    await MetricaRuta.where({ periodo: inicio })
      .where((m) =>
        or(
          ...claves.map(({ origenId, destinoId, aerolineaId }) =>
            and(
              m.origenId.eq(origenId),
              m.destinoId.eq(destinoId),
              m.aerolineaId.eq(aerolineaId),
            ),
          ),
        ),
      )
      .updateAndCount({ pendiente: true, errorActualizacion: null });
  }
}
