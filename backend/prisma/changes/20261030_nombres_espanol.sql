-- Stop API and ETL workers before applying; deploy backend/frontend together.
BEGIN;
ALTER TABLE users RENAME TO usuarios;
ALTER TABLE usuarios RENAME COLUMN email TO correo;
ALTER TABLE usuarios RENAME COLUMN password_hash TO hash_contrasena;
ALTER TABLE usuarios RENAME COLUMN role TO rol;
ALTER TABLE usuarios RENAME COLUMN created_at TO creado_en;
ALTER TABLE usuarios RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE countries RENAME TO paises;
ALTER TABLE paises RENAME COLUMN name TO nombre;
ALTER TABLE paises RENAME COLUMN iso_code TO codigo_iso;
ALTER TABLE airports RENAME TO aeropuertos;
ALTER TABLE aeropuertos RENAME COLUMN country_link_inferred TO vinculo_pais_inferido;
ALTER TABLE aeropuertos RENAME COLUMN openflights_id TO id_openflights;
ALTER TABLE aeropuertos RENAME COLUMN name TO nombre;
ALTER TABLE aeropuertos RENAME COLUMN city TO ciudad;
ALTER TABLE aeropuertos RENAME COLUMN country_name TO nombre_pais;
ALTER TABLE aeropuertos RENAME COLUMN country_id TO pais_id;
ALTER TABLE aeropuertos RENAME COLUMN latitude TO latitud;
ALTER TABLE aeropuertos RENAME COLUMN longitude TO longitud;
ALTER TABLE aeropuertos RENAME COLUMN location TO ubicacion;
ALTER TABLE aeropuertos RENAME COLUMN source TO fuente;
ALTER TABLE aeropuertos RENAME COLUMN route_count TO cantidad_rutas;
ALTER TABLE airlines RENAME TO aerolineas;
ALTER TABLE aerolineas RENAME COLUMN country_link_inferred TO vinculo_pais_inferido;
ALTER TABLE aerolineas RENAME COLUMN openflights_id TO id_openflights;
ALTER TABLE aerolineas RENAME COLUMN name TO nombre;
ALTER TABLE aerolineas RENAME COLUMN country TO pais;
ALTER TABLE aerolineas RENAME COLUMN country_id TO pais_id;
ALTER TABLE aerolineas RENAME COLUMN active TO activa;
ALTER TABLE routes RENAME TO rutas;
ALTER TABLE rutas RENAME COLUMN airline_code TO codigo_aerolinea;
ALTER TABLE rutas RENAME COLUMN airline_id TO aerolinea_id;
ALTER TABLE rutas RENAME COLUMN origin_id TO origen_id;
ALTER TABLE rutas RENAME COLUMN destination_id TO destino_id;
ALTER TABLE rutas RENAME COLUMN codeshare TO codigo_compartido;
ALTER TABLE rutas RENAME COLUMN stops TO escalas;
ALTER TABLE etl_jobs RENAME TO ejecuciones_etl;
ALTER TABLE ejecuciones_etl RENAME COLUMN attempt TO intento;
ALTER TABLE ejecuciones_etl RENAME COLUMN source TO fuente;
ALTER TABLE ejecuciones_etl RENAME COLUMN status TO estado;
ALTER TABLE ejecuciones_etl RENAME COLUMN total_rows TO filas_totales;
ALTER TABLE ejecuciones_etl RENAME COLUMN processed_rows TO filas_procesadas;
ALTER TABLE ejecuciones_etl RENAME COLUMN inserted_rows TO filas_insertadas;
ALTER TABLE ejecuciones_etl RENAME COLUMN discarded_rows TO filas_descartadas;
ALTER TABLE ejecuciones_etl RENAME COLUMN started_at TO iniciado_en;
ALTER TABLE ejecuciones_etl RENAME COLUMN finished_at TO finalizado_en;
ALTER TABLE ejecuciones_etl RENAME COLUMN error_message TO mensaje_error;
ALTER TABLE ejecuciones_etl RENAME COLUMN pipeline_id TO proceso_id;
ALTER TABLE ejecuciones_etl RENAME COLUMN requested_by_id TO solicitante_id;
ALTER TABLE ejecuciones_etl RENAME COLUMN configuration_snapshot TO instantanea_configuracion;
ALTER TABLE ejecuciones_etl RENAME COLUMN source_uri TO uri_fuente;
ALTER TABLE ejecuciones_etl RENAME COLUMN source_checksum TO checksum_fuente;
ALTER TABLE etl_pipelines RENAME TO procesos_etl;
ALTER TABLE procesos_etl RENAME COLUMN name TO nombre;
ALTER TABLE procesos_etl RENAME COLUMN dataset_name TO nombre_conjunto;
ALTER TABLE procesos_etl RENAME COLUMN description TO descripcion;
ALTER TABLE procesos_etl RENAME COLUMN target_entity TO entidad_destino;
ALTER TABLE procesos_etl RENAME COLUMN is_system TO es_sistema;
ALTER TABLE procesos_etl RENAME COLUMN paused TO pausado;
ALTER TABLE procesos_etl RENAME COLUMN connection TO conexion;
ALTER TABLE procesos_etl RENAME COLUMN schema_mapping TO mapeo_esquema;
ALTER TABLE procesos_etl RENAME COLUMN schedule_config TO configuracion_programacion;
ALTER TABLE procesos_etl RENAME COLUMN archived_at TO archivado_en;
ALTER TABLE procesos_etl RENAME COLUMN created_at TO creado_en;
ALTER TABLE procesos_etl RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE etl_discarded_samples RENAME TO muestras_descartadas_etl;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN attempt TO intento;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN job_id TO ejecucion_id;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN row_index TO numero_fila;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN field TO campo;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN reason TO motivo;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN raw_sample TO muestra_original;
ALTER TABLE muestras_descartadas_etl RENAME COLUMN created_at TO creado_en;
ALTER TABLE etl_job_events RENAME TO eventos_ejecucion_etl;
ALTER TABLE eventos_ejecucion_etl RENAME COLUMN attempt TO intento;
ALTER TABLE eventos_ejecucion_etl RENAME COLUMN message TO mensaje;
ALTER TABLE eventos_ejecucion_etl RENAME COLUMN job_id TO ejecucion_id;
ALTER TABLE eventos_ejecucion_etl RENAME COLUMN level TO nivel;
ALTER TABLE eventos_ejecucion_etl RENAME COLUMN created_at TO creado_en;
ALTER TABLE flights RENAME TO vuelos;
ALTER TABLE vuelos RENAME COLUMN source TO fuente;
ALTER TABLE vuelos RENAME COLUMN source_record_id TO id_registro_fuente;
ALTER TABLE vuelos RENAME COLUMN flight_date TO fecha_vuelo;
ALTER TABLE vuelos RENAME COLUMN flight_number TO numero_vuelo;
ALTER TABLE vuelos RENAME COLUMN origin_id TO origen_id;
ALTER TABLE vuelos RENAME COLUMN destination_id TO destino_id;
ALTER TABLE vuelos RENAME COLUMN airline_id TO aerolinea_id;
ALTER TABLE vuelos RENAME COLUMN status TO estado;
ALTER TABLE vuelos RENAME COLUMN arrival_delay_minutes TO demora_llegada_minutos;
ALTER TABLE vuelos RENAME COLUMN etl_job_id TO ejecucion_etl_id;
ALTER TABLE route_metrics RENAME TO metricas_ruta;
ALTER TABLE metricas_ruta RENAME COLUMN origin_id TO origen_id;
ALTER TABLE metricas_ruta RENAME COLUMN destination_id TO destino_id;
ALTER TABLE metricas_ruta RENAME COLUMN airline_id TO aerolinea_id;
ALTER TABLE metricas_ruta RENAME COLUMN period TO periodo;
ALTER TABLE metricas_ruta RENAME COLUMN total_flights TO vuelos_totales;
ALTER TABLE metricas_ruta RENAME COLUMN cancelled_flights TO vuelos_cancelados;
ALTER TABLE metricas_ruta RENAME COLUMN diverted_flights TO vuelos_desviados;
ALTER TABLE metricas_ruta RENAME COLUMN on_time_flights TO vuelos_puntuales;
ALTER TABLE metricas_ruta RENAME COLUMN total_arrival_delay_minutes TO demora_llegada_total_minutos;
ALTER TABLE metricas_ruta RENAME COLUMN updated_at TO actualizado_en;


ALTER TABLE procesos_etl DROP CONSTRAINT etl_pipelines_connection_check;
ALTER TABLE procesos_etl DROP CONSTRAINT etl_pipelines_mapping_check;
ALTER TABLE procesos_etl DROP CONSTRAINT etl_pipelines_schedule_check;
ALTER TABLE procesos_etl DROP CONSTRAINT etl_pipelines_target_entity_check_178c8562;
ALTER TABLE ejecuciones_etl DROP CONSTRAINT etl_jobs_snapshot_check;

CREATE FUNCTION pg_temp.traducir_configuracion(valor jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE resultado jsonb; clave text; contenido jsonb;
BEGIN
 IF jsonb_typeof(valor) = 'object' THEN
  resultado := '{}'::jsonb;
  FOR clave, contenido IN SELECT * FROM jsonb_each(valor) LOOP
   IF clave = 'targetField' AND jsonb_typeof(contenido) = 'string' THEN
    contenido := COALESCE(('{"passwordHash": "hashContrasena", "createdAt": "creadoEn", "updatedAt": "actualizadoEn", "requestedJobs": "ejecucionesSolicitadas", "isoCode": "codigoIso", "countryLinkInferred": "vinculoPaisInferido", "openflightsId": "idOpenflights", "countryName": "nombrePais", "countryId": "paisId", "countryRecord": "registroPais", "routeCount": "cantidadRutas", "originRoutes": "rutasOrigen", "destinationRoutes": "rutasDestino", "departingFlights": "vuelosSalida", "arrivingFlights": "vuelosLlegada", "originMetrics": "metricasOrigen", "destinationMetrics": "metricasDestino", "airlineCode": "codigoAerolinea", "airlineId": "aerolineaId", "originId": "origenId", "destinationId": "destinoId", "codeshare": "codigoCompartido", "stops": "escalas", "totalRows": "filasTotales", "processedRows": "filasProcesadas", "insertedRows": "filasInsertadas", "discardedRows": "filasDescartadas", "startedAt": "iniciadoEn", "finishedAt": "finalizadoEn", "errorMessage": "mensajeError", "pipelineId": "procesoId", "requestedById": "solicitanteId", "configurationSnapshot": "instantaneaConfiguracion", "sourceUri": "uriFuente", "sourceChecksum": "checksumFuente", "requestedBy": "solicitante", "discardedSamples": "muestrasDescartadas", "datasetName": "nombreConjunto", "targetEntity": "entidadDestino", "isSystem": "esSistema", "schemaMapping": "mapeoEsquema", "scheduleConfig": "configuracionProgramacion", "archivedAt": "archivadoEn", "jobId": "ejecucionId", "rowIndex": "numeroFila", "rawSample": "muestraOriginal", "sourceRecordId": "idRegistroFuente", "flightDate": "fechaVuelo", "flightNumber": "numeroVuelo", "arrivalDelayMinutes": "demoraLlegadaMinutos", "etlJobId": "ejecucionEtlId", "etlJob": "ejecucionEtl", "totalFlights": "vuelosTotales", "cancelledFlights": "vuelosCancelados", "divertedFlights": "vuelosDesviados", "onTimeFlights": "vuelosPuntuales", "totalArrivalDelayMinutes": "demoraLlegadaTotalMinutos", "period": "periodo", "attempt": "intento", "latitude": "latitud", "longitude": "longitud", "location": "ubicacion", "city": "ciudad", "country": "pais", "active": "activa", "airline": "aerolinea", "origin": "origen", "destination": "destino", "metrics": "metricas", "flights": "vuelos", "events": "eventos", "jobs": "ejecuciones", "pipeline": "proceso", "paused": "pausado", "connection": "conexion", "description": "descripcion", "field": "campo", "reason": "motivo", "level": "nivel", "email": "correo", "role": "rol", "name": "nombre", "source": "fuente", "status": "estado", "sourceType": "tipoFuente", "endpointUrl": "urlEndpoint", "httpMethod": "metodoHttp", "dataFormat": "formatoDatos", "csvDelimiter": "separadorCsv", "csvHasHeader": "csvConCabecera", "credentialRef": "referenciaCredencial", "sourceColumn": "columnaOrigen", "targetField": "campoDestino", "cronExpression": "expresionCron", "batchSize": "tamanoLote", "timeoutSeconds": "tiempoLimiteSegundos", "maxRetries": "maximoReintentos", "originOpenflightsId": "idOpenflightsOrigen", "destinationOpenflightsId": "idOpenflightsDestino", "airlineOpenflightsId": "idOpenflightsAerolinea", "originCode": "codigoOrigen", "destinationCode": "codigoDestino", "includeReturn": "incluirRegreso", "originCountryId": "paisOrigenId", "destinationCountryId": "paisDestinoId", "originContinent": "continenteOrigen", "destinationContinent": "continenteDestino", "distanceKm": "distanciaKm", "distanceNm": "distanciaNm", "coordinates": "coordenadas", "operatorsCount": "cantidadOperadores", "operators": "operadores", "airlineName": "nombreAerolinea", "airlineIata": "iataAerolinea", "outbound": "ida", "inbound": "vuelta", "connectionsCount": "cantidadConexiones", "users": "usuarios", "countries": "paises", "airports": "aeropuertos", "airlines": "aerolineas", "routes": "rutas"}'::jsonb)->(contenido #>> '{}'), contenido);
   END IF;
   resultado := resultado || jsonb_build_object(COALESCE(('{"passwordHash": "hashContrasena", "createdAt": "creadoEn", "updatedAt": "actualizadoEn", "requestedJobs": "ejecucionesSolicitadas", "isoCode": "codigoIso", "countryLinkInferred": "vinculoPaisInferido", "openflightsId": "idOpenflights", "countryName": "nombrePais", "countryId": "paisId", "countryRecord": "registroPais", "routeCount": "cantidadRutas", "originRoutes": "rutasOrigen", "destinationRoutes": "rutasDestino", "departingFlights": "vuelosSalida", "arrivingFlights": "vuelosLlegada", "originMetrics": "metricasOrigen", "destinationMetrics": "metricasDestino", "airlineCode": "codigoAerolinea", "airlineId": "aerolineaId", "originId": "origenId", "destinationId": "destinoId", "codeshare": "codigoCompartido", "stops": "escalas", "totalRows": "filasTotales", "processedRows": "filasProcesadas", "insertedRows": "filasInsertadas", "discardedRows": "filasDescartadas", "startedAt": "iniciadoEn", "finishedAt": "finalizadoEn", "errorMessage": "mensajeError", "pipelineId": "procesoId", "requestedById": "solicitanteId", "configurationSnapshot": "instantaneaConfiguracion", "sourceUri": "uriFuente", "sourceChecksum": "checksumFuente", "requestedBy": "solicitante", "discardedSamples": "muestrasDescartadas", "datasetName": "nombreConjunto", "targetEntity": "entidadDestino", "isSystem": "esSistema", "schemaMapping": "mapeoEsquema", "scheduleConfig": "configuracionProgramacion", "archivedAt": "archivadoEn", "jobId": "ejecucionId", "rowIndex": "numeroFila", "rawSample": "muestraOriginal", "sourceRecordId": "idRegistroFuente", "flightDate": "fechaVuelo", "flightNumber": "numeroVuelo", "arrivalDelayMinutes": "demoraLlegadaMinutos", "etlJobId": "ejecucionEtlId", "etlJob": "ejecucionEtl", "totalFlights": "vuelosTotales", "cancelledFlights": "vuelosCancelados", "divertedFlights": "vuelosDesviados", "onTimeFlights": "vuelosPuntuales", "totalArrivalDelayMinutes": "demoraLlegadaTotalMinutos", "period": "periodo", "attempt": "intento", "latitude": "latitud", "longitude": "longitud", "location": "ubicacion", "city": "ciudad", "country": "pais", "active": "activa", "airline": "aerolinea", "origin": "origen", "destination": "destino", "metrics": "metricas", "flights": "vuelos", "events": "eventos", "jobs": "ejecuciones", "pipeline": "proceso", "paused": "pausado", "connection": "conexion", "description": "descripcion", "field": "campo", "reason": "motivo", "level": "nivel", "email": "correo", "role": "rol", "name": "nombre", "source": "fuente", "status": "estado", "sourceType": "tipoFuente", "endpointUrl": "urlEndpoint", "httpMethod": "metodoHttp", "dataFormat": "formatoDatos", "csvDelimiter": "separadorCsv", "csvHasHeader": "csvConCabecera", "credentialRef": "referenciaCredencial", "sourceColumn": "columnaOrigen", "targetField": "campoDestino", "cronExpression": "expresionCron", "batchSize": "tamanoLote", "timeoutSeconds": "tiempoLimiteSegundos", "maxRetries": "maximoReintentos", "originOpenflightsId": "idOpenflightsOrigen", "destinationOpenflightsId": "idOpenflightsDestino", "airlineOpenflightsId": "idOpenflightsAerolinea", "originCode": "codigoOrigen", "destinationCode": "codigoDestino", "includeReturn": "incluirRegreso", "originCountryId": "paisOrigenId", "destinationCountryId": "paisDestinoId", "originContinent": "continenteOrigen", "destinationContinent": "continenteDestino", "distanceKm": "distanciaKm", "distanceNm": "distanciaNm", "coordinates": "coordenadas", "operatorsCount": "cantidadOperadores", "operators": "operadores", "airlineName": "nombreAerolinea", "airlineIata": "iataAerolinea", "outbound": "ida", "inbound": "vuelta", "connectionsCount": "cantidadConexiones", "users": "usuarios", "countries": "paises", "airports": "aeropuertos", "airlines": "aerolineas", "routes": "rutas"}'::jsonb)->>clave, clave), pg_temp.traducir_configuracion(contenido));
  END LOOP;
  RETURN resultado;
 ELSIF jsonb_typeof(valor) = 'array' THEN
  SELECT COALESCE(jsonb_agg(pg_temp.traducir_configuracion(elemento) ORDER BY posicion), '[]'::jsonb)
    INTO resultado FROM jsonb_array_elements(valor) WITH ORDINALITY AS elementos(elemento, posicion);
  RETURN resultado;
 END IF;
 RETURN valor;
END;
$$;
UPDATE procesos_etl SET conexion=pg_temp.traducir_configuracion(conexion), mapeo_esquema=pg_temp.traducir_configuracion(mapeo_esquema), configuracion_programacion=pg_temp.traducir_configuracion(configuracion_programacion), entidad_destino=CASE entidad_destino WHEN 'countries' THEN 'paises' WHEN 'airports' THEN 'aeropuertos' WHEN 'airlines' THEN 'aerolineas' WHEN 'routes' THEN 'rutas' ELSE entidad_destino END;
UPDATE ejecuciones_etl SET instantanea_configuracion=pg_temp.traducir_configuracion(instantanea_configuracion), fuente=CASE fuente WHEN 'countries' THEN 'paises' WHEN 'airports' THEN 'aeropuertos' WHEN 'airlines' THEN 'aerolineas' WHEN 'routes' THEN 'rutas' ELSE fuente END;

-- Required before Prisma creates tables with validation checks.
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION public.sync_airport_location()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.ubicacion := ST_SetSRID(ST_MakePoint(NEW.longitud, NEW.latitud), 4326)::geography;
  RETURN NEW;
END;
$function$;

-- HTTP DTOs validate supported options; storage also forbids literal credentials.
CREATE OR REPLACE FUNCTION public.etl_valid_connection(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'object'
   AND config - ARRAY['tipoFuente','urlEndpoint','metodoHttp','headers','formatoDatos','separadorCsv','csvConCabecera'] = '{}'::jsonb
   AND config->>'tipoFuente' = 'http_stream' AND config->>'metodoHttp' = 'GET' AND config->>'formatoDatos' = 'csv'
   AND config->>'urlEndpoint' ~ '^https://[^/[:space:]]+'
   AND config->>'urlEndpoint' !~ '://[^/]*@|[?#]'
   AND (NOT config ? 'headers' OR jsonb_typeof(config->'headers') = 'array')
   AND NOT EXISTS (
     SELECT FROM jsonb_array_elements(CASE WHEN jsonb_typeof(config->'headers') = 'array' THEN config->'headers' ELSE '[]'::jsonb END) h
     WHERE (jsonb_typeof(h) = 'object' AND h - ARRAY['key','referenciaCredencial'] = '{}'::jsonb
       AND jsonb_typeof(h->'key') = 'string' AND length(btrim(h->>'key')) > 0
       AND h->>'referenciaCredencial' ~ '^[A-Za-z_][A-Za-z0-9_]*$') IS NOT TRUE
   )) IS TRUE;
$function$;

CREATE OR REPLACE FUNCTION public.etl_valid_schedule(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'object'
   AND config - ARRAY['expresionCron','tamanoLote','tiempoLimiteSegundos','maximoReintentos'] = '{}'::jsonb
   AND jsonb_typeof(config->'expresionCron') = 'string'
   AND jsonb_typeof(config->'tamanoLote') = 'number'
   AND jsonb_typeof(config->'tiempoLimiteSegundos') = 'number'
   AND jsonb_typeof(config->'maximoReintentos') = 'number'
   AND (config->>'tamanoLote')::numeric BETWEEN 1000 AND 5000
   AND (config->>'tamanoLote')::numeric % 1 = 0
   AND (config->>'tiempoLimiteSegundos')::numeric BETWEEN 1 AND 3600
   AND (config->>'tiempoLimiteSegundos')::numeric % 1 = 0
   AND (config->>'maximoReintentos')::numeric BETWEEN 0 AND 10
   AND (config->>'maximoReintentos')::numeric % 1 = 0) IS TRUE;
$function$;

-- Field names, transforms and required mappings are validated by the typed HTTP boundary.
CREATE OR REPLACE FUNCTION public.etl_valid_mapping(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'array') IS TRUE;
$function$;

ALTER TABLE procesos_etl ADD CONSTRAINT etl_pipelines_mapping_check CHECK ((etl_valid_mapping(mapeo_esquema) IS TRUE));
ALTER TABLE procesos_etl ADD CONSTRAINT etl_pipelines_schedule_check CHECK ((etl_valid_schedule(configuracion_programacion) IS TRUE));
ALTER TABLE procesos_etl ADD CONSTRAINT etl_pipelines_connection_check CHECK ((etl_valid_connection(conexion) IS TRUE));
ALTER TABLE ejecuciones_etl ADD CONSTRAINT etl_jobs_snapshot_check CHECK ((((instantanea_configuracion IS NULL) AND (proceso_id IS NULL)) OR (((jsonb_typeof(instantanea_configuracion) = 'object'::text) AND ((instantanea_configuracion - ARRAY['conexion'::text, 'mapeoEsquema'::text, 'configuracionProgramacion'::text]) = '{}'::jsonb) AND etl_valid_connection((instantanea_configuracion -> 'conexion'::text)) AND etl_valid_mapping((instantanea_configuracion -> 'mapeoEsquema'::text)) AND etl_valid_schedule((instantanea_configuracion -> 'configuracionProgramacion'::text))) IS TRUE)));
ALTER TABLE procesos_etl ADD CONSTRAINT etl_pipelines_target_entity_check_178c8562 CHECK (entidad_destino IN ('paises','aeropuertos','aerolineas','rutas','otp_metrics'));
COMMIT;
