-- Deploy the backend writers before this migration; stop old workers first.
BEGIN;
ALTER TABLE procesos_etl DROP CONSTRAINT IF EXISTS etl_pipelines_mapping_check;
ALTER TABLE procesos_etl DROP CONSTRAINT IF EXISTS etl_pipelines_schedule_check;
ALTER TABLE procesos_etl DROP CONSTRAINT IF EXISTS etl_pipelines_connection_check;
ALTER TABLE ejecuciones_etl DROP CONSTRAINT IF EXISTS etl_jobs_snapshot_check;
ALTER TABLE ejecuciones_etl ADD CONSTRAINT etl_jobs_snapshot_check CHECK (((instantanea_configuracion IS NULL AND proceso_id IS NULL) OR (jsonb_typeof(instantanea_configuracion) = 'object' AND instantanea_configuracion ?& ARRAY['conexion','mapeoEsquema','configuracionProgramacion'] AND instantanea_configuracion - ARRAY['conexion','mapeoEsquema','configuracionProgramacion'] = '{}'::jsonb)) IS TRUE);
DROP TRIGGER IF EXISTS airports_sync_location ON aeropuertos;
DROP FUNCTION IF EXISTS public.sync_airport_location();
DROP FUNCTION IF EXISTS public.etl_valid_connection(jsonb);
DROP FUNCTION IF EXISTS public.etl_valid_schedule(jsonb);
DROP FUNCTION IF EXISTS public.etl_valid_mapping(jsonb);
COMMIT;
