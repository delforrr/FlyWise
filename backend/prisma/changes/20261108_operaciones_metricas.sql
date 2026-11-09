BEGIN;
ALTER TABLE vuelos ALTER COLUMN ejecucion_etl_id DROP NOT NULL;
ALTER TABLE vuelos ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN protegido_manualmente boolean NOT NULL DEFAULT false,
  ADD COLUMN archivado_en timestamp(3), ADD COLUMN ultima_observacion jsonb;
CREATE TABLE historial_vuelos (
  id text PRIMARY KEY, vuelo_id text NOT NULL REFERENCES vuelos(id), version integer NOT NULL,
  accion text NOT NULL, actor_id text, instantanea jsonb NOT NULL,
  creado_en timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(vuelo_id,version)
);
ALTER TABLE metricas_ruta ALTER COLUMN ejecucion_etl_id DROP NOT NULL, ALTER COLUMN actualizado_en DROP NOT NULL;
ALTER TABLE metricas_ruta ADD COLUMN pendiente boolean NOT NULL DEFAULT false,
  ADD COLUMN error_actualizacion text, ADD COLUMN fuentes jsonb NOT NULL DEFAULT '[]';
CREATE INDEX metricas_ruta_pendientes_idx ON metricas_ruta(periodo) WHERE pendiente;
-- Existing imported operations remain restorable after their first administrative correction.
UPDATE vuelos SET ultima_observacion=jsonb_build_object('fechaVuelo',fecha_vuelo,'numeroVuelo',numero_vuelo,
 'origenId',origen_id,'destinoId',destino_id,'aerolineaId',aerolinea_id,'estado',estado,'demoraLlegadaMinutos',demora_llegada_minutos);
INSERT INTO metricas_ruta(origen_id,destino_id,aerolinea_id,periodo,vuelos_totales,pendiente)
SELECT DISTINCT origen_id,destino_id,aerolinea_id,date_trunc('month',fecha_vuelo)::date,0,true FROM vuelos
ON CONFLICT (origen_id,destino_id,aerolinea_id,periodo) DO UPDATE SET pendiente=true;
COMMIT;
