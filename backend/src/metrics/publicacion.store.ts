import { bloquearRecurso } from '../prisma/bloqueo-transaccional.js';
import { ultimoDiaDelMes } from '../prisma/timestamp.js';
import type { Operacion } from '../entities/vuelos/domain/operacion.js';
import type { Database, Transaction } from '../prisma/db.js';
import { publicarOtp } from './application/publicar-otp.js';

import type { Poblacion } from './application/recalcular-pendientes.js';

export async function leerPublicacionesDelTramo(
  tx: Database | Transaction,
  { origenId, destinoId, periodo }: Omit<Poblacion, 'aerolineaId'>,
) {
  const filas = await tx.orm.public.MetricaRuta.where({
    origenId,
    destinoId,
    periodo: periodo + '-01',
  })
    .select(
      'aerolineaId',
      'ejecucionEtlId',
      'actualizadoEn',
      'vuelosTotales',
      'fuentes',
    )
    .include('ejecucionEtl', (ejecucion) => ejecucion.select('fuente'))
    .all();
  return filas.map(
    ({ ejecucionEtl, ejecucionEtlId, actualizadoEn, ...fila }) => ({
      ...fila,
      fuente: ejecucionEtl?.fuente ?? null,
      ejecucionId: ejecucionEtlId,
      actualizadoEn,
      actualizada: actualizadoEn !== null,
      incluyeOag: Array.isArray(fila.fuentes)
        ? fila.fuentes.includes('OAG')
        : fila.fuentes === 'OAG' ||
          (fila.fuentes !== null &&
            typeof fila.fuentes === 'object' &&
            Object.hasOwn(fila.fuentes, 'OAG')),
    }),
  );
}

export async function escribirPublicacion(
  tx: Transaction,
  { periodo, origenId, destinoId, aerolineaId }: Poblacion,
  autoridad: { fuente: string; ejecucionId: string | null },
) {
  const desde = periodo + '-01';
  const hasta = ultimoDiaDelMes(desde);
  const clave = { origenId, destinoId, aerolineaId, periodo: desde };
  return publicarOtp(
    {
      async *leer() {
        let ultimoId = '';
        for (;;) {
          const lote = await tx.orm.public.Vuelo.where({
            origenId,
            destinoId,
            aerolineaId,
            archivadoEn: null,
            fuente: autoridad.fuente,
            ejecucionEtlId: autoridad.ejecucionId || null,
          })
            .where((v) => v.fechaVuelo.gte(desde))
            .where((v) => v.fechaVuelo.lte(hasta))
            .where((v) => v.id.gt(ultimoId))
            .select('id', 'estado', 'fuente', 'demoraLlegadaMinutos')
            .orderBy((v) => v.id.asc())
            .limit(1000)
            .all();
          yield lote.map((vuelo) => {
            if (
              vuelo.estado !== 'ARRIVED' &&
              vuelo.estado !== 'CANCELLED' &&
              vuelo.estado !== 'DIVERTED'
            ) {
              throw new Error('Estado de operación inválido para calcular OTP');
            }
            return { ...vuelo, estado: vuelo.estado };
          });
          if (lote.length < 1000) break;
          ultimoId = lote[lote.length - 1].id;
        }
      },
      async publicar(resumen, fuentes) {
        const valores = {
          vuelosTotales: resumen.total,
          vuelosCancelados: resumen.cancelados,
          vuelosDesviados: resumen.desviados,
          vuelosPuntuales: resumen.puntuales,
          vuelosSinEvidencia: resumen.sinEvidencia,
          demoraLlegadaTotalMinutos: resumen.demoraTotal,
          fuentes,
          ejecucionEtlId: autoridad.ejecucionId || null,
          actualizadoEn: new Date()
            .toISOString()
            .slice(0, -1)
            .replace('T', ' '),
          pendiente: false,
          errorActualizacion: null,
        };
        await tx.orm.public.MetricaRuta.select('periodo').upsert({
          create: { ...clave, ...valores },
          update: valores,
        });
      },
    },
    autoridad.fuente,
  );
}

export async function marcarPendiente(
  tx: Transaction,
  operacion: Pick<
    Operacion,
    'origenId' | 'destinoId' | 'aerolineaId' | 'fechaVuelo'
  >,
) {
  const { origenId, destinoId, aerolineaId, fechaVuelo } = operacion;
  await tx.orm.public.MetricaRuta.select('periodo').upsert({
    create: {
      origenId,
      destinoId,
      aerolineaId,
      periodo: fechaVuelo.slice(0, 7) + '-01',
      vuelosTotales: 0,
      pendiente: true,
    },
    update: { pendiente: true, errorActualizacion: null },
  });
}

export async function bloquearCambiosMetricas(tx: Transaction) {
  // A publication sees every operation and its pending marker in the same generation.
  await bloquearRecurso(tx, 'metricas');
}
