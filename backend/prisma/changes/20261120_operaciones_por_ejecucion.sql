BEGIN;
ALTER TABLE ejecuciones_etl
  ADD COLUMN lista_para_publicar boolean NOT NULL DEFAULT false;
ALTER TABLE vuelos
  ADD CONSTRAINT vuelos_fuente_registro_ejecucion_key
  UNIQUE (fuente, id_registro_fuente, ejecucion_etl_id);
ALTER TABLE vuelos
  DROP CONSTRAINT IF EXISTS vuelos_fuente_id_registro_fuente_key,
  DROP CONSTRAINT IF EXISTS flights_source_source_record_id_key;
COMMIT;
