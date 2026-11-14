import type { Operacion } from '../entities/vuelos/domain/operacion.js';
import type { Transaction } from '../prisma/db.js';
import { publicarOtp } from './application/publicar-otp.js';

import type { Poblacion } from './application/recalcular-pendientes.js';

export function leerPublicacionesDelTramo(
  tx: Transaction,
  { origenId, destinoId, periodo }: Omit<Poblacion, 'aerolineaId'>,
) {
  return tx.query(
    tx.raw.sql`
      SELECT m.aerolinea_id AS "aerolineaId", e.fuente,
        m.ejecucion_etl_id AS "ejecucionId", m.actualizado_en IS NOT NULL AS actualizada,
        m.vuelos_totales AS "vuelosTotales", m.fuentes, m.fuentes ? 'OAG' AS "incluyeOag"
      FROM metricas_ruta m
      LEFT JOIN ejecuciones_etl e ON m.ejecucion_etl_id=e.id
      WHERE m.origen_id=${origenId} AND m.destino_id=${destinoId}
        AND m.periodo=${periodo + '-01'}::date
    `
      .returnsRow({
        aerolineaId: 'pg/text@1',
        fuente: { codecId: 'pg/text@1', nullable: true },
        ejecucionId: { codecId: 'pg/text@1', nullable: true },
        actualizada: 'pg/bool@1',
        vuelosTotales: 'pg/int4@1',
        fuentes: 'pg/jsonb@1',
        incluyeOag: 'pg/bool@1',
      })
      .build(),
  );
}

export async function escribirPublicacion(
  tx: Transaction,
  { periodo, origenId, destinoId, aerolineaId }: Poblacion,
  autoridad: { fuente: string; ejecucionId: string | null },
) {
  const desde = periodo + '-01';
  return publicarOtp(
    {
      async *leer() {
        let ultimoId = '';
        for (;;) {
          const lote = await tx.query(
            tx.raw.sql`
        SELECT id, estado, fuente, demora_llegada_minutos AS "demoraLlegadaMinutos"
        FROM vuelos
        WHERE origen_id=${origenId} AND destino_id=${destinoId} AND aerolinea_id=${aerolineaId}
          AND archivado_en IS NULL AND fecha_vuelo>=${desde}::date
          AND fecha_vuelo<${desde}::date+interval '1 month'
          AND fuente=${autoridad.fuente}
          AND ejecucion_etl_id IS NOT DISTINCT FROM NULLIF(${autoridad.ejecucionId ?? ''}::text,'')
          AND id>${ultimoId}
        ORDER BY id LIMIT 1000
      `
              .returnsRow({
                id: 'pg/text@1',
                estado: 'pg/text@1',
                fuente: 'pg/text@1',
                demoraLlegadaMinutos: { codecId: 'pg/int4@1', nullable: true },
              })
              .build(),
          );
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
        await tx.execute(
          tx.raw.sql`
      INSERT INTO metricas_ruta(
        origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,vuelos_cancelados,
        vuelos_desviados,vuelos_puntuales,vuelos_sin_evidencia,demora_llegada_total_minutos,
        fuentes,ejecucion_etl_id,actualizado_en,pendiente
      ) VALUES (
        ${origenId},${destinoId},${aerolineaId},${desde}::date,
        ${resumen.total},${resumen.cancelados},${resumen.desviados},${resumen.puntuales},
        ${resumen.sinEvidencia},${resumen.demoraTotal.toString()}::bigint,
        ${JSON.stringify(fuentes)}::jsonb,NULLIF(${autoridad.ejecucionId ?? ''}::text,''),
        CURRENT_TIMESTAMP,false
      )
      ON CONFLICT(origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET
        vuelos_totales=EXCLUDED.vuelos_totales,vuelos_cancelados=EXCLUDED.vuelos_cancelados,
        vuelos_desviados=EXCLUDED.vuelos_desviados,vuelos_puntuales=EXCLUDED.vuelos_puntuales,
        vuelos_sin_evidencia=EXCLUDED.vuelos_sin_evidencia,
        demora_llegada_total_minutos=EXCLUDED.demora_llegada_total_minutos,
        fuentes=EXCLUDED.fuentes,ejecucion_etl_id=EXCLUDED.ejecucion_etl_id,
        actualizado_en=EXCLUDED.actualizado_en,pendiente=false,error_actualizacion=NULL
    `
            .affectedCount()
            .build(),
        );
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
  await tx.execute(
    tx.raw.sql`
      INSERT INTO metricas_ruta(origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,vuelos_cancelados,vuelos_desviados,vuelos_puntuales,demora_llegada_total_minutos,actualizado_en,pendiente)
      VALUES (${operacion.origenId},${operacion.destinoId},${operacion.aerolineaId},${operacion.fechaVuelo.slice(0, 7) + '-01'}::date,0,0,0,0,0,NULL,true)
      ON CONFLICT (origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET pendiente=true,error_actualizacion=NULL
    `
      .affectedCount()
      .build(),
  );
}

export async function bloquearCambiosMetricas(tx: Transaction) {
  // A publication sees every operation and its pending marker in the same generation.
  await tx.execute(
    tx.raw.sql`SELECT pg_advisory_xact_lock(826103)`.affectedCount().build(),
  );
}
