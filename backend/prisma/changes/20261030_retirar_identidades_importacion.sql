-- Detener API/workers y respaldar la base antes de aplicar.
-- Sincronizar los .dat con la versión anterior si hay ofertas sin clave.
BEGIN;
LOCK TABLE ofertas_ruta, identidades_importacion_ruta IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ofertas_ruta WHERE fuente='OpenFlights' AND clave_importacion IS NULL) THEN
    RAISE EXCEPTION 'Sincronizar el catálogo con la versión anterior antes de retirar identidades: hay ofertas OpenFlights sin clave_importacion';
  END IF;
END $$;
DROP TABLE identidades_importacion_ruta;
COMMIT;
