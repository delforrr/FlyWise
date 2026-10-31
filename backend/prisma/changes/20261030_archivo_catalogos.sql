BEGIN;
ALTER TABLE aeropuertos ADD COLUMN archivado_en timestamp(3), ADD COLUMN protegido_manualmente boolean NOT NULL DEFAULT false;
ALTER TABLE aerolineas ADD COLUMN archivado_en timestamp(3), ADD COLUMN protegido_manualmente boolean NOT NULL DEFAULT false;
ALTER TABLE rutas ADD COLUMN archivado_en timestamp(3), ADD COLUMN protegido_manualmente boolean NOT NULL DEFAULT false;
ALTER TABLE rutas DROP CONSTRAINT routes_airline_id_fkey, DROP CONSTRAINT routes_origin_id_fkey, DROP CONSTRAINT routes_destination_id_fkey;
ALTER TABLE rutas ADD CONSTRAINT routes_airline_id_fkey FOREIGN KEY (aerolinea_id) REFERENCES aerolineas(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE rutas ADD CONSTRAINT routes_origin_id_fkey FOREIGN KEY (origen_id) REFERENCES aeropuertos(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE rutas ADD CONSTRAINT routes_destination_id_fkey FOREIGN KEY (destino_id) REFERENCES aeropuertos(id) ON UPDATE CASCADE ON DELETE RESTRICT;
COMMIT;
