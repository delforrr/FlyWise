import { randomUUID } from 'node:crypto';
import type { Transaction } from '../prisma/db.js';
import type { ObservacionVuelo } from './operacion.js';

export async function guardarObservaciones(
  tx: Transaction,
  observaciones: ObservacionVuelo[],
  ejecucionId: string,
) {
  const entrada = JSON.stringify(
    observaciones.map(({ fuente, idRegistroFuente, ...observacion }) => ({
      fuente,
      idRegistroFuente,
      ...observacion,
      id: randomUUID(),
      observacion,
    })),
  );
  const [resultado] = await tx.query(
    tx.raw.sql`
    WITH entrada AS (
      SELECT * FROM jsonb_to_recordset(${entrada}::jsonb) AS e(id text,fuente text,"idRegistroFuente" text,"fechaVuelo" date,"numeroVuelo" text,"origenId" text,"destinoId" text,"aerolineaId" text,estado text,"demoraLlegadaMinutos" integer,observacion jsonb)
    ), anteriores AS (
      SELECT v.* FROM vuelos v JOIN entrada e ON v.fuente=e.fuente AND v.id_registro_fuente=e."idRegistroFuente"
    ), cambios AS (
      INSERT INTO vuelos(id,fuente,id_registro_fuente,fecha_vuelo,numero_vuelo,origen_id,destino_id,aerolinea_id,estado,demora_llegada_minutos,ejecucion_etl_id,ultima_observacion)
      SELECT id,fuente,"idRegistroFuente","fechaVuelo","numeroVuelo","origenId","destinoId","aerolineaId",estado,"demoraLlegadaMinutos",${ejecucionId},observacion FROM entrada
      ON CONFLICT(fuente,id_registro_fuente) DO UPDATE SET
        fecha_vuelo=CASE WHEN vuelos.protegido_manualmente THEN vuelos.fecha_vuelo ELSE EXCLUDED.fecha_vuelo END,
        numero_vuelo=CASE WHEN vuelos.protegido_manualmente THEN vuelos.numero_vuelo ELSE EXCLUDED.numero_vuelo END,
        origen_id=CASE WHEN vuelos.protegido_manualmente THEN vuelos.origen_id ELSE EXCLUDED.origen_id END,
        destino_id=CASE WHEN vuelos.protegido_manualmente THEN vuelos.destino_id ELSE EXCLUDED.destino_id END,
        aerolinea_id=CASE WHEN vuelos.protegido_manualmente THEN vuelos.aerolinea_id ELSE EXCLUDED.aerolinea_id END,
        estado=CASE WHEN vuelos.protegido_manualmente THEN vuelos.estado ELSE EXCLUDED.estado END,
        demora_llegada_minutos=CASE WHEN vuelos.protegido_manualmente THEN vuelos.demora_llegada_minutos ELSE EXCLUDED.demora_llegada_minutos END,
        archivado_en=CASE WHEN vuelos.protegido_manualmente THEN vuelos.archivado_en ELSE NULL END,
        ejecucion_etl_id=EXCLUDED.ejecucion_etl_id,ultima_observacion=EXCLUDED.ultima_observacion,version=vuelos.version+1
      RETURNING *, (xmax=0) AS insertada
    ), auditoria AS (
      INSERT INTO historial_vuelos(id,vuelo_id,version,accion,instantanea)
      SELECT gen_random_uuid()::text,id,version,CASE WHEN insertada THEN 'importar' ELSE 'observacion-fuente' END,
        jsonb_build_object('id',id,'version',version,'fuente',fuente,'idRegistroFuente',id_registro_fuente,
          'fechaVuelo',fecha_vuelo,'numeroVuelo',numero_vuelo,'origenId',origen_id,'destinoId',destino_id,
          'aerolineaId',aerolinea_id,'estado',estado,'demoraLlegadaMinutos',demora_llegada_minutos,
          'protegidoManualmente',protegido_manualmente,'archivadoEn',archivado_en,'ejecucionEtlId',ejecucion_etl_id,'ultimaObservacion',ultima_observacion)
      FROM cambios
    ), poblaciones AS (
      SELECT origen_id,destino_id,aerolinea_id,date_trunc('month',fecha_vuelo)::date AS periodo FROM anteriores
      UNION SELECT origen_id,destino_id,aerolinea_id,date_trunc('month',fecha_vuelo)::date FROM cambios
    ), pendientes AS (
      INSERT INTO metricas_ruta(origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,actualizado_en,pendiente)
      SELECT origen_id,destino_id,aerolinea_id,periodo,0,NULL,true FROM poblaciones
      ORDER BY origen_id,destino_id,aerolinea_id,periodo
      ON CONFLICT(origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET pendiente=true,error_actualizacion=NULL
    )
    SELECT count(*)::integer AS procesadas,count(*) FILTER(WHERE insertada)::integer AS insertadas FROM cambios
  `
      .returnsRow({ procesadas: 'pg/int4@1', insertadas: 'pg/int4@1' })
      .build(),
  );
  return resultado;
}
