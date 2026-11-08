BEGIN;
CREATE TABLE identidades_aeropuerto_fuente (
  fuente text NOT NULL,
  identificador text NOT NULL,
  aeropuerto_id text REFERENCES aeropuertos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  observacion jsonb NOT NULL,
  PRIMARY KEY (fuente, identificador)
);
CREATE INDEX identidades_aeropuerto_fuente_aeropuerto_id_idx ON identidades_aeropuerto_fuente(aeropuerto_id);
COMMIT;
