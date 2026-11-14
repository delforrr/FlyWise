BEGIN;

ALTER TABLE vuelos DROP CONSTRAINT flights_arrival_delay_check;
ALTER TABLE vuelos ADD CONSTRAINT flights_arrival_delay_check
  CHECK (estado = 'ARRIVED'::text OR demora_llegada_minutos IS NULL);

ALTER TABLE metricas_ruta ADD COLUMN vuelos_sin_evidencia integer NOT NULL DEFAULT 0;

COMMIT;
