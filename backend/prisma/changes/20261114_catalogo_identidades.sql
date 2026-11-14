BEGIN;
CREATE TABLE IF NOT EXISTS identidades_aerolinea_fuente (
  fuente text NOT NULL,
  identificador text NOT NULL,
  aerolinea_id text NOT NULL REFERENCES aerolineas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  observacion json NOT NULL,
  PRIMARY KEY (fuente, identificador)
);
CREATE INDEX IF NOT EXISTS identidades_aerolinea_fuente_aerolinea_id_idx ON identidades_aerolinea_fuente(aerolinea_id);
INSERT INTO identidades_aeropuerto_fuente(fuente,identificador,aeropuerto_id,observacion)
SELECT 'OpenFlights',a.id_openflights::text,a.id,json_build_object('nombrePais',a.nombre_pais)
FROM aeropuertos a WHERE a.id_openflights IS NOT NULL
ON CONFLICT(fuente,identificador) DO UPDATE
SET aeropuerto_id=EXCLUDED.aeropuerto_id
WHERE identidades_aeropuerto_fuente.aeropuerto_id IS NULL;
INSERT INTO identidades_aerolinea_fuente(fuente,identificador,aerolinea_id,observacion)
SELECT 'OpenFlights',id_openflights::text,id,json_build_object('pais',pais)
FROM aerolineas WHERE id_openflights IS NOT NULL
ON CONFLICT(fuente,identificador) DO NOTHING;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM aeropuertos a LEFT JOIN identidades_aeropuerto_fuente i
      ON i.fuente='OpenFlights' AND i.identificador=a.id_openflights::text
    WHERE a.id_openflights IS NOT NULL AND i.aeropuerto_id IS DISTINCT FROM a.id
  ) OR EXISTS (
    SELECT 1 FROM aerolineas a LEFT JOIN identidades_aerolinea_fuente i
      ON i.fuente='OpenFlights' AND i.identificador=a.id_openflights::text
    WHERE a.id_openflights IS NOT NULL AND i.aerolinea_id IS DISTINCT FROM a.id
  ) THEN RAISE EXCEPTION 'Correspondencias OpenFlights incompatibles'; END IF;
END $$;
COMMIT;
