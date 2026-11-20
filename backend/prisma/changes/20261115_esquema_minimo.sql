BEGIN;

DROP VIEW IF EXISTS public.cantidades_rutas_aeropuerto;

ALTER TABLE public.paises
  DROP CONSTRAINT IF EXISTS countries_name_check,
  DROP CONSTRAINT IF EXISTS countries_iso_check;

ALTER TABLE public.aeropuertos
  DROP CONSTRAINT IF EXISTS airports_name_check,
  DROP CONSTRAINT IF EXISTS airports_codes_check;

ALTER TABLE public.aerolineas
  DROP CONSTRAINT IF EXISTS airlines_name_check,
  DROP CONSTRAINT IF EXISTS airlines_codes_check;

ALTER TABLE public.rutas
  DROP CONSTRAINT IF EXISTS rutas_extremos_check;

ALTER TABLE public.ofertas_ruta
  DROP CONSTRAINT IF EXISTS routes_stops_check,
  DROP CONSTRAINT IF EXISTS routes_airline_code_check;

ALTER TABLE public.actividad_revisiones
  DROP CONSTRAINT IF EXISTS actividad_anac_revisiones_periodo_check,
  DROP CONSTRAINT IF EXISTS actividad_anac_revisiones_estado_check;

ALTER TABLE public.movimientos_aeropuerto
  DROP CONSTRAINT IF EXISTS actividad_anac_movimientos_movimiento_check;

ALTER TABLE public.vuelos
  DROP CONSTRAINT IF EXISTS flights_arrival_delay_check,
  DROP CONSTRAINT IF EXISTS flights_endpoints_check,
  DROP CONSTRAINT IF EXISTS flights_source_check;

ALTER TABLE public.metricas_ruta
  DROP CONSTRAINT IF EXISTS route_metrics_delay_check,
  DROP CONSTRAINT IF EXISTS route_metrics_counts_check,
  DROP CONSTRAINT IF EXISTS route_metrics_period_check,
  DROP CONSTRAINT IF EXISTS route_metrics_endpoints_check;

ALTER TABLE public.eurocontrol_programacion
  DROP CONSTRAINT IF EXISTS eurocontrol_programacion_producto_check;

ALTER TABLE public.indicadores_instantaneas
  DROP CONSTRAINT IF EXISTS indicadores_instantaneas_producto_check;

ALTER TABLE public.indicadores_externos
  DROP CONSTRAINT IF EXISTS indicadores_externos_ambito_check,
  DROP CONSTRAINT IF EXISTS indicadores_externos_granularidad_check,
  DROP CONSTRAINT IF EXISTS indicadores_externos_check;

ALTER TABLE public.configuracion_bts
  DROP CONSTRAINT IF EXISTS configuracion_bts_periodo_check;

ALTER TABLE public.cobertura_bts
  DROP CONSTRAINT IF EXISTS cobertura_bts_filas_check;

ALTER TABLE public.procesos_etl
  DROP CONSTRAINT IF EXISTS etl_pipelines_connection_check,
  DROP CONSTRAINT IF EXISTS etl_pipelines_mapping_check,
  DROP CONSTRAINT IF EXISTS etl_pipelines_schedule_check;

DROP TRIGGER IF EXISTS airports_sync_location ON public.aeropuertos;
DROP FUNCTION IF EXISTS public.sync_airport_location();
DROP FUNCTION IF EXISTS public.etl_valid_connection(jsonb);
DROP FUNCTION IF EXISTS public.etl_valid_schedule(jsonb);
DROP FUNCTION IF EXISTS public.etl_valid_mapping(jsonb);

COMMIT;
