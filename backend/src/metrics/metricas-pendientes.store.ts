import type { Database, Transaction } from '../prisma/db.js';
import {
  LOTE_METRICAS_PENDIENTES,
  recalcularPendientes,
} from './application/recalcular-pendientes.js';
import {
  bloquearCambiosMetricas,
  escribirPublicacion,
} from './publicacion.store.js';

export async function recalcularMetricasPendientes(tx: Transaction) {
  await bloquearCambiosMetricas(tx);
  return recalcularPendientes({
    leerPendientes: async () =>
      tx.query(
        tx.raw.sql`
            SELECT m.origen_id AS "origenId",m.destino_id AS "destinoId",
              m.aerolinea_id AS "aerolineaId",to_char(m.periodo,'YYYY-MM') AS periodo,
              m.ejecucion_etl_id AS "ejecucionId", m.actualizado_en IS NOT NULL AS actualizada,
              m.vuelos_totales AS "vuelosTotales", m.fuentes
            FROM metricas_ruta m
            WHERE m.pendiente
            ORDER BY m.origen_id,m.destino_id,m.aerolinea_id,m.periodo LIMIT ${LOTE_METRICAS_PENDIENTES}
          `
          .returnsRow({
            origenId: 'pg/text@1',
            destinoId: 'pg/text@1',
            aerolineaId: 'pg/text@1',
            periodo: 'pg/text@1',
            ejecucionId: { codecId: 'pg/text@1', nullable: true },
            actualizada: 'pg/bool@1',
            vuelosTotales: 'pg/int4@1',
            fuentes: 'pg/jsonb@1',
          })
          .build(),
      ),
    async limpiarPendiente(poblacion) {
      await tx.orm.public.MetricaRuta.where({
        ...poblacion,
        periodo: poblacion.periodo + '-01',
      }).update({ pendiente: false, errorActualizacion: null });
    },
    publicarAdministrativa: (poblacion) =>
      escribirPublicacion(tx, poblacion, {
        fuente: 'Administrativa',
        ejecucionId: null,
      }),
  });
}

export async function registrarErrorMetricas(db: Database, error: unknown) {
  const mensaje =
    error instanceof Error
      ? error.message.slice(0, 500)
      : 'Falló la actualización de métricas';
  await db.execute(
    db.raw
      .sql`UPDATE metricas_ruta SET error_actualizacion=${mensaje} WHERE pendiente`
      .affectedCount()
      .build(),
  );
}
