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
    leerPendientes: () => leerMetricasPendientes(tx),
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
  await db.orm.public.MetricaRuta.where({ pendiente: true }).updateAndCount({
    errorActualizacion: mensaje,
  });
}

async function leerMetricasPendientes(tx: Transaction) {
  const filas = await tx.orm.public.MetricaRuta.where({ pendiente: true })
    .select(
      'origenId',
      'destinoId',
      'aerolineaId',
      'periodo',
      'ejecucionEtlId',
      'actualizadoEn',
      'vuelosTotales',
      'fuentes',
    )
    .orderBy([
      (m) => m.origenId.asc(),
      (m) => m.destinoId.asc(),
      (m) => m.aerolineaId.asc(),
      (m) => m.periodo.asc(),
    ])
    .limit(LOTE_METRICAS_PENDIENTES)
    .all();
  return filas.map(({ periodo, ejecucionEtlId, actualizadoEn, ...fila }) => ({
    ...fila,
    periodo: periodo.slice(0, 7),
    ejecucionId: ejecucionEtlId,
    actualizada: actualizadoEn !== null,
  }));
}
