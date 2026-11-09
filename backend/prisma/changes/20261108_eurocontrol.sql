BEGIN;
CREATE TABLE eurocontrol_programacion (
  producto text PRIMARY KEY CHECK (producto IN ('network','stakeholder')),
  pausado boolean NOT NULL DEFAULT true,
  actualizado_en timestamp(3) NOT NULL DEFAULT now()
);
INSERT INTO eurocontrol_programacion(producto) VALUES ('network'),('stakeholder');
CREATE TABLE eurocontrol_instantaneas (
  id text PRIMARY KEY,
  producto text NOT NULL CHECK (producto IN ('network','stakeholder')),
  ejecucion_id text NOT NULL REFERENCES ejecuciones_etl(id) ON DELETE RESTRICT,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  uri text NOT NULL,
  atribucion text NOT NULL DEFAULT 'EUROCONTROL',
  aviso text NOT NULL DEFAULT '',
  metodologia jsonb NOT NULL DEFAULT '[]',
  publicada boolean NOT NULL DEFAULT false,
  creado_en timestamp(3) NOT NULL DEFAULT now(),
  UNIQUE(ejecucion_id)
);
CREATE INDEX eurocontrol_instantaneas_producto_idx ON eurocontrol_instantaneas(producto,publicada,creado_en);
CREATE TABLE indicadores_externos (
  instantanea_id text NOT NULL REFERENCES eurocontrol_instantaneas(id) ON DELETE RESTRICT,
  ambito text NOT NULL CHECK (ambito IN ('NETWORK','COUNTRY','AIRPORT')),
  entidad text NOT NULL,
  nombre text NOT NULL,
  granularidad text NOT NULL CHECK (granularidad IN ('DY','WK','Y2D')),
  desde date NOT NULL,
  hasta date NOT NULL,
  valores jsonb NOT NULL,
  PRIMARY KEY(instantanea_id,ambito,entidad,granularidad,hasta),
  CHECK(desde<=hasta)
);
CREATE INDEX indicadores_externos_consulta_idx ON indicadores_externos(ambito,entidad,granularidad,hasta);
COMMIT;
