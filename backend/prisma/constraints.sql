-- Prisma PSL does not express NULLS NOT DISTINCT in this installed version.
BEGIN;
ALTER TABLE ofertas_ruta DROP CONSTRAINT IF EXISTS ofertas_ruta_identidad_key;
ALTER TABLE ofertas_ruta ADD CONSTRAINT ofertas_ruta_identidad_key UNIQUE NULLS NOT DISTINCT (ruta_id,aerolinea_id,codigo_aerolinea,codigo_compartido,escalas);

INSERT INTO actividad_anac_config (id, ficha_url)
VALUES ('ANAC', 'https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac/archivo/7b6d0103-0a69-4c67-aed9-33cb58ae12f5')
ON CONFLICT (id) DO NOTHING;

INSERT INTO eurocontrol_programacion (producto)
VALUES ('network'), ('stakeholder')
ON CONFLICT (producto) DO NOTHING;

COMMIT;
