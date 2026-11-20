-- Seed for a disposable database initialized with the T08 contract.
BEGIN;

INSERT INTO public.paises (id, nombre, codigo_iso)
VALUES ('t09-ar', 'Argentina', 'AR');

INSERT INTO public.aeropuertos
  (id, nombre, nombre_pais, pais_id, iata, latitud, longitud, ubicacion, protegido_manualmente)
VALUES
  ('t09-aer', 'Aeroparque', 'Argentina', 't09-ar', 'AEP', -34.56, -58.42,
   ST_SetSRID(ST_MakePoint(-58.42, -34.56), 4326)::geography, true),
  ('t09-cba', 'Córdoba', 'País informado sin correspondencia', NULL, 'COR', -31.32, -64.21,
   ST_SetSRID(ST_MakePoint(-64.21, -31.32), 4326)::geography, false);

INSERT INTO public.identidades_aeropuerto_fuente
  (fuente, identificador, aeropuerto_id, observacion)
VALUES
  ('ANAC', 'AER', 't09-aer', '{}'),
  ('ANAC', 'CBA', 't09-cba', '{}'),
  ('OurAirports', '9001', NULL, '{"nombrePais":"País informado sin correspondencia"}');

INSERT INTO public.aerolineas (id, nombre, iata, pais_id)
VALUES ('t09-operadora', 'Operadora sintética', 'AR', 't09-ar');

INSERT INTO public.rutas (id, origen_id, destino_id)
VALUES ('t09-ruta', 't09-aer', 't09-cba');

INSERT INTO public.ofertas_ruta (id, ruta_id, aerolinea_id, codigo_aerolinea, codigo_compartido)
VALUES
  ('t09-oferta', 't09-ruta', 't09-operadora', 'AR', false),
  ('t09-compartida', 't09-ruta', NULL, 'YY', true);

INSERT INTO public.ejecuciones_etl
  (id, fuente, estado, iniciado_en, finalizado_en,
   filas_totales, filas_procesadas, filas_insertadas, uri_fuente, checksum_fuente)
VALUES
  ('t09-oag', 'OAG', 'completed', '2026-09-01 10:00:00', '2026-09-01 10:01:00',
   1, 1, 1, 'https://example.test/oag', repeat('a', 64)),
  ('t09-anac', 'ANAC', 'completed', '2026-09-01 10:00:00', '2026-09-01 10:01:00',
   1, 1, 1, 'https://example.test/anac.csv', repeat('b', 64));

INSERT INTO public.vuelos
  (id, fuente, id_registro_fuente, fecha_vuelo, numero_vuelo, origen_id, destino_id,
   aerolinea_id, estado, demora_llegada_minutos, ejecucion_etl_id, horarios)
VALUES
  ('t09-vuelo', 'OAG', 'AR123', '2026-08-31', 'AR123', 't09-aer', 't09-cba',
   't09-operadora', 'ARRIVED', 15, 't09-oag',
   '{"salidaProgramadaUtc":"2026-09-01T02:30:00Z","salidaRealUtc":null,"llegadaProgramadaUtc":"2026-09-01T04:00:00Z","llegadaRealUtc":"2026-09-01T04:15:00Z","desfaseOrigenMinutos":-180,"evidenciaFecha":"desfase-origen"}');

INSERT INTO public.historial_vuelos (id, vuelo_id, version, accion, instantanea)
VALUES ('t09-historial', 't09-vuelo', 1, 'importar', '{"ejecucionEtlId":"t09-oag"}');

INSERT INTO public.metricas_ruta
  (origen_id, destino_id, aerolinea_id, periodo, vuelos_totales, vuelos_puntuales,
   demora_llegada_total_minutos, fuentes, ejecucion_etl_id, actualizado_en)
VALUES ('t09-aer', 't09-cba', 't09-operadora', '2026-08-01', 1, 1, 15,
        '["OAG"]', 't09-oag', '2026-09-01 10:01:00');

INSERT INTO public.actividad_revisiones (id, periodo, uri, checksum, estado, filas_procesadas)
VALUES ('t09-anac', '2026-08-01', 'https://example.test/anac.csv', repeat('b', 64), 'publicada', 1);

INSERT INTO public.movimientos_aeropuerto
  (revision_id, numero_fila, fecha_utc, movimiento, aeropuerto, origen, destino,
   operador, clase, clasificacion, calidad)
VALUES ('t09-anac', 1, '2026-09-01 02:30:00', 'DESPEGUE', 'AER', 'AER', 'CBA',
        'Operadora sintética', 'Regular', 'Doméstico', 'DEFINITIVO');

INSERT INTO public.actividad_publicaciones (periodo, revision_id)
VALUES ('2026-08-01', 't09-anac');

COMMIT;
