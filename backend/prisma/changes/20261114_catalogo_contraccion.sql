BEGIN;
ALTER TABLE aeropuertos DROP COLUMN id_openflights, DROP COLUMN cantidad_rutas;
ALTER TABLE aerolineas DROP COLUMN id_openflights;
COMMIT;
