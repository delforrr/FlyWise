BEGIN;
CREATE TABLE configuracion_bts (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  periodo text NOT NULL CHECK(periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  pausado boolean NOT NULL DEFAULT true,
  expresion_cron text NOT NULL DEFAULT ''
);
CREATE TABLE identidades_operador_bts (
  identificador text PRIMARY KEY,
  codigo text NOT NULL,
  aerolinea_id text REFERENCES aerolineas(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE preparacion_bts (
  ejecucion_id text NOT NULL REFERENCES ejecuciones_etl(id) ON DELETE RESTRICT,
  identidad text NOT NULL,
  numero_fila integer NOT NULL,
  observacion jsonb NOT NULL,
  PRIMARY KEY(ejecucion_id,identidad)
);
CREATE TABLE cobertura_bts (
  periodo text PRIMARY KEY,
  ejecucion_id text NOT NULL REFERENCES ejecuciones_etl(id) ON DELETE RESTRICT,
  filas integer NOT NULL CHECK(filas > 0),
  publicado_en timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
