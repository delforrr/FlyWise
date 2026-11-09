BEGIN;
CREATE TABLE actividad_anac_config (
  id text PRIMARY KEY CHECK (id='ANAC'),
  ficha_url text NOT NULL,
  expresion_cron text NOT NULL DEFAULT '0 5 20 * *',
  pausado boolean NOT NULL DEFAULT true
);
INSERT INTO actividad_anac_config(id,ficha_url) VALUES ('ANAC','https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac/archivo/7b6d0103-0a69-4c67-aed9-33cb58ae12f5');
CREATE TABLE actividad_anac_revisiones (
  id text PRIMARY KEY REFERENCES ejecuciones_etl(id) ON DELETE RESTRICT,
  periodo date NOT NULL CHECK (extract(day from periodo)=1),
  uri text NOT NULL,
  checksum text,
  estado text NOT NULL DEFAULT 'procesando' CHECK (estado IN ('procesando','publicada','rechazada')),
  filas_procesadas integer NOT NULL DEFAULT 0,
  filas_descartadas integer NOT NULL DEFAULT 0,
  actualizado_en timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX actividad_anac_revisiones_periodo_idx ON actividad_anac_revisiones(periodo,actualizado_en);
CREATE TABLE actividad_anac_publicaciones (
  periodo date PRIMARY KEY,
  revision_id text NOT NULL REFERENCES actividad_anac_revisiones(id) ON DELETE RESTRICT
);
CREATE TABLE actividad_anac_movimientos (
  revision_id text NOT NULL REFERENCES actividad_anac_revisiones(id) ON DELETE RESTRICT,
  numero_fila integer NOT NULL,
  fecha_utc timestamp NOT NULL,
  movimiento text NOT NULL CHECK (movimiento IN ('DESPEGUE','ATERRIZAJE')),
  aeropuerto text NOT NULL,
  origen text NOT NULL,
  destino text NOT NULL,
  operador text NOT NULL,
  clase text NOT NULL,
  clasificacion text NOT NULL,
  aeronave text NOT NULL,
  matricula text NOT NULL,
  pasajeros integer CHECK (pasajeros>=0),
  pax integer CHECK (pax>=0),
  calidad text NOT NULL,
  PRIMARY KEY(revision_id,numero_fila)
);
CREATE INDEX actividad_anac_movimientos_filtros_idx ON actividad_anac_movimientos(revision_id,aeropuerto,operador,clasificacion);
COMMIT;
