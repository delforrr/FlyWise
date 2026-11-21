BEGIN;
ALTER TABLE identidades_aeropuerto_fuente
  ADD COLUMN IF NOT EXISTS rechazado_en timestamp(3);
CREATE INDEX IF NOT EXISTS identidades_aeropuerto_fuente_fuente_rechazado_en_idx_95a0cf80
  ON identidades_aeropuerto_fuente(fuente, rechazado_en);
COMMIT;
