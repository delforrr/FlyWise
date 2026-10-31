BEGIN;
LOCK TABLE vuelos, metricas_ruta IN ACCESS EXCLUSIVE MODE;
-- Nunca inventar una ejecución para completar la procedencia histórica.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vuelos WHERE ejecucion_etl_id IS NULL) THEN
    RAISE EXCEPTION 'Existen vuelos sin procedencia: vincularlos con su ejecución real antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM metricas_ruta) THEN
    RAISE EXCEPTION 'Existen métricas: preparar una migración de procedencia con sus ejecuciones reales antes de continuar';
  END IF;
END $$;
ALTER TABLE vuelos ALTER COLUMN ejecucion_etl_id SET NOT NULL;
ALTER TABLE vuelos DROP CONSTRAINT flights_etl_job_id_fkey;
ALTER TABLE vuelos ADD CONSTRAINT flights_etl_job_id_fkey FOREIGN KEY(ejecucion_etl_id) REFERENCES ejecuciones_etl(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE metricas_ruta ADD COLUMN ejecucion_etl_id text NOT NULL REFERENCES ejecuciones_etl(id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX metricas_ruta_ejecucion_etl_idx ON metricas_ruta(ejecucion_etl_id);
COMMIT;
