-- Required before Prisma creates tables with validation checks.
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION public.sync_airport_location()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$function$;

-- HTTP DTOs validate supported options; storage also forbids literal credentials.
CREATE OR REPLACE FUNCTION public.etl_valid_connection(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'object'
   AND config - ARRAY['sourceType','endpointUrl','httpMethod','headers','dataFormat','csvDelimiter','csvHasHeader'] = '{}'::jsonb
   AND config->>'sourceType' = 'http_stream' AND config->>'httpMethod' = 'GET' AND config->>'dataFormat' = 'csv'
   AND config->>'endpointUrl' ~ '^https://[^/[:space:]]+'
   AND config->>'endpointUrl' !~ '://[^/]*@|[?#]'
   AND (NOT config ? 'headers' OR jsonb_typeof(config->'headers') = 'array')
   AND NOT EXISTS (
     SELECT FROM jsonb_array_elements(CASE WHEN jsonb_typeof(config->'headers') = 'array' THEN config->'headers' ELSE '[]'::jsonb END) h
     WHERE (jsonb_typeof(h) = 'object' AND h - ARRAY['key','credentialRef'] = '{}'::jsonb
       AND jsonb_typeof(h->'key') = 'string' AND length(btrim(h->>'key')) > 0
       AND h->>'credentialRef' ~ '^[A-Za-z_][A-Za-z0-9_]*$') IS NOT TRUE
   )) IS TRUE;
$function$;

CREATE OR REPLACE FUNCTION public.etl_valid_schedule(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'object'
   AND config - ARRAY['cronExpression','batchSize','timeoutSeconds','maxRetries'] = '{}'::jsonb
   AND jsonb_typeof(config->'cronExpression') = 'string'
   AND jsonb_typeof(config->'batchSize') = 'number'
   AND jsonb_typeof(config->'timeoutSeconds') = 'number'
   AND jsonb_typeof(config->'maxRetries') = 'number'
   AND (config->>'batchSize')::numeric BETWEEN 1000 AND 5000
   AND (config->>'batchSize')::numeric % 1 = 0
   AND (config->>'timeoutSeconds')::numeric BETWEEN 1 AND 3600
   AND (config->>'timeoutSeconds')::numeric % 1 = 0
   AND (config->>'maxRetries')::numeric BETWEEN 0 AND 10
   AND (config->>'maxRetries')::numeric % 1 = 0) IS TRUE;
$function$;

-- Field names, transforms and required mappings are validated by the typed HTTP boundary.
CREATE OR REPLACE FUNCTION public.etl_valid_mapping(config jsonb)
 RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
 SELECT (jsonb_typeof(config) = 'array') IS TRUE;
$function$;
