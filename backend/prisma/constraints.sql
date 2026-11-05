-- Prisma PSL does not express NULLS NOT DISTINCT in this installed version.
BEGIN;
ALTER TABLE ofertas_ruta DROP CONSTRAINT IF EXISTS ofertas_ruta_identidad_key;
ALTER TABLE ofertas_ruta ADD CONSTRAINT ofertas_ruta_identidad_key UNIQUE NULLS NOT DISTINCT (ruta_id,aerolinea_id,codigo_aerolinea,codigo_compartido,escalas);
COMMIT;
