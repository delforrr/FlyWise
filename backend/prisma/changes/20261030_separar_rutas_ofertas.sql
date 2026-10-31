-- Aplicar después de 20261030_identidad_importacion.sql, con los workers detenidos.
BEGIN;
LOCK TABLE rutas, identidades_importacion_ruta IN ACCESS EXCLUSIVE MODE;
ALTER TABLE rutas RENAME TO ofertas_ruta;
CREATE TABLE rutas (
  id text PRIMARY KEY,
  origen_id text NOT NULL REFERENCES aeropuertos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  destino_id text NOT NULL REFERENCES aeropuertos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  archivado_en timestamp(3),
  protegido_manualmente boolean NOT NULL DEFAULT false,
  CONSTRAINT rutas_extremos_key UNIQUE (origen_id,destino_id),
  CONSTRAINT rutas_extremos_check CHECK (origen_id<>destino_id)
);
CREATE INDEX rutas_destino_idx ON rutas(destino_id);
INSERT INTO rutas(id,origen_id,destino_id)
SELECT gen_random_uuid()::text,origen_id,destino_id FROM ofertas_ruta GROUP BY origen_id,destino_id;
ALTER TABLE ofertas_ruta ADD COLUMN ruta_id text;
UPDATE ofertas_ruta o SET ruta_id=r.id FROM rutas r WHERE r.origen_id=o.origen_id AND r.destino_id=o.destino_id;
ALTER TABLE ofertas_ruta ALTER COLUMN ruta_id SET NOT NULL;
ALTER TABLE ofertas_ruta ADD CONSTRAINT ofertas_ruta_ruta_fk FOREIGN KEY(ruta_id) REFERENCES rutas(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE ofertas_ruta DROP CONSTRAINT routes_offer_key;
ALTER TABLE ofertas_ruta DROP COLUMN origen_id, DROP COLUMN destino_id;
ALTER TABLE ofertas_ruta ADD CONSTRAINT ofertas_ruta_identidad_key UNIQUE NULLS NOT DISTINCT(ruta_id,aerolinea_id,codigo_aerolinea,codigo_compartido,escalas);
ALTER TABLE identidades_importacion_ruta RENAME COLUMN ruta_id TO oferta_id;
COMMIT;
