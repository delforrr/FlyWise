import type { Transaction } from '../prisma/db.js';

// La publicación ya tiene el bloqueo de cambios de operaciones de importarLote.
export async function retirarAusentesBts(
  tx: Transaction,
  periodo: string,
  ejecucionId: string,
) {
  const inicio = `${periodo}-01`;
  await tx.execute(
    tx.raw.sql`
    WITH retiradas AS (
      UPDATE vuelos v SET archivado_en=CURRENT_TIMESTAMP, version=v.version+1,
        ejecucion_etl_id=${ejecucionId}
      WHERE v.fuente='BTS' AND NOT v.protegido_manualmente AND v.archivado_en IS NULL
        AND v.fecha_vuelo >= ${inicio}::date AND v.fecha_vuelo < ${inicio}::date + interval '1 month'
        AND NOT EXISTS (SELECT 1 FROM preparacion_bts p
          WHERE p.ejecucion_id=${ejecucionId} AND p.identidad=v.id_registro_fuente)
      RETURNING v.*
    ), auditoria AS (
      INSERT INTO historial_vuelos(id,vuelo_id,version,accion,instantanea)
      SELECT gen_random_uuid()::text,id,version,'retiro-fuente',
        jsonb_build_object('id',id,'version',version,'fuente',fuente,'idRegistroFuente',id_registro_fuente,
          'fechaVuelo',fecha_vuelo,'numeroVuelo',numero_vuelo,'origenId',origen_id,'destinoId',destino_id,
          'aerolineaId',aerolinea_id,'estado',estado,'demoraLlegadaMinutos',demora_llegada_minutos,
          'protegidoManualmente',false,'archivadoEn',archivado_en,'ejecucionEtlId',ejecucion_etl_id,'ultimaObservacion',ultima_observacion)
      FROM retiradas
    )
    INSERT INTO metricas_ruta(origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,actualizado_en,pendiente)
    SELECT DISTINCT origen_id,destino_id,aerolinea_id,${inicio}::date,0,NULL::timestamp,true FROM retiradas
    ON CONFLICT(origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET pendiente=true,error_actualizacion=NULL
  `
      .affectedCount()
      .build(),
  );
}
