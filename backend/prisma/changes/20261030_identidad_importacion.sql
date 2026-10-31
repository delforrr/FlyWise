BEGIN;
ALTER TABLE aerolineas ADD COLUMN fuente text NOT NULL DEFAULT 'OpenFlights';
ALTER TABLE rutas ADD COLUMN fuente text NOT NULL DEFAULT 'OpenFlights', ADD COLUMN clave_importacion text;
ALTER TABLE rutas ADD CONSTRAINT rutas_clave_importacion_key UNIQUE (clave_importacion);
CREATE TABLE identidades_importacion_ruta (
  clave text PRIMARY KEY,
  ruta_id text NOT NULL REFERENCES rutas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  origen_id text NOT NULL REFERENCES aeropuertos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  destino_id text NOT NULL REFERENCES aeropuertos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  aerolinea_id text REFERENCES aerolineas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  id_openflights_aerolinea integer,
  id_openflights_origen integer,
  id_openflights_destino integer,
  codigo_aerolinea text,
  codigo_compartido boolean NOT NULL,
  escalas integer NOT NULL
);
CREATE INDEX identidades_ruta_oferta_idx ON identidades_importacion_ruta(origen_id,destino_id,codigo_compartido,escalas);
CREATE INDEX identidades_ruta_ruta_id_idx ON identidades_importacion_ruta(ruta_id);
CREATE INDEX identidades_ruta_destino_id_idx ON identidades_importacion_ruta(destino_id);
CREATE INDEX identidades_ruta_aerolinea_id_idx ON identidades_importacion_ruta(aerolinea_id);
COMMIT;
