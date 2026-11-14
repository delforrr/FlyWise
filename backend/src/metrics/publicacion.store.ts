import type { Transaction } from '../prisma/db.js';
import { publicarOtp } from './domain/publicar-otp.js';

type Poblacion = {
  origenId: string;
  destinoId: string;
  aerolineaId: string;
  periodo: string;
};

export async function cambioFuenteSinAutorizar(
  tx: Transaction,
  { origenId, destinoId, periodo }: Omit<Poblacion, 'aerolineaId'>,
  fuente: string,
  operadoras: string[],
  autorizadas: string[],
) {
  const [conflicto] = await tx.query(
    tx.raw.sql`
      SELECT m.aerolinea_id AS id
      FROM metricas_ruta m
      LEFT JOIN ejecuciones_etl e ON m.ejecucion_etl_id=e.id
      WHERE m.origen_id=${origenId} AND m.destino_id=${destinoId}
        AND m.periodo=${periodo + '-01'}::date
        AND (e.fuente<>${fuente} OR (e.id IS NULL AND m.actualizado_en IS NOT NULL
          AND m.vuelos_totales>0 AND m.fuentes<>'["Administrativa"]'::jsonb
          AND m.fuentes<>jsonb_build_array(${fuente}::text)))
        AND ${JSON.stringify(operadoras)}::jsonb ? m.aerolinea_id
        AND NOT (${JSON.stringify(autorizadas)}::jsonb ? m.aerolinea_id)
      LIMIT 1
    `
      .returnsRow({ id: 'pg/text@1' })
      .build(),
  );
  return conflicto;
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
