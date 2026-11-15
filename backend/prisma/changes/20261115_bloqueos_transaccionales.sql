BEGIN;
CREATE TABLE IF NOT EXISTS bloqueos_transaccionales (
  recurso text PRIMARY KEY
);
INSERT INTO bloqueos_transaccionales(recurso)
VALUES ('catalogo'), ('metricas'), ('admisiones'), ('bts')
ON CONFLICT (recurso) DO NOTHING;
COMMIT;
