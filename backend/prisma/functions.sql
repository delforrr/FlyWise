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
