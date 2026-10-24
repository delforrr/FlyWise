-- Apply after deploying functions.sql. Compatible with the previous contract.
-- Derived route values are recomputed on reads; catalogue and audit rows are preserved.
BEGIN;
ALTER TABLE etl_pipelines DROP CONSTRAINT IF EXISTS etl_pipelines_target_entity_check_a9c4c381;
ALTER TABLE etl_pipelines DROP CONSTRAINT IF EXISTS etl_pipelines_target_entity_check_178c8562;
ALTER TABLE etl_pipelines ADD CONSTRAINT etl_pipelines_target_entity_check_178c8562 CHECK (target_entity IN ('countries','airlines','airports','routes','otp_metrics'));
ALTER TABLE routes DROP COLUMN IF EXISTS distance_km, DROP COLUMN IF EXISTS popularity_score;
ALTER TABLE airlines ALTER COLUMN active DROP NOT NULL, ALTER COLUMN active DROP DEFAULT;
ALTER TABLE etl_jobs ADD COLUMN IF NOT EXISTS inserted_rows integer NOT NULL DEFAULT 0;
-- Display-only schedule keys are removed from configurations and historical snapshots.
ALTER TABLE etl_pipelines DROP CONSTRAINT IF EXISTS etl_pipelines_schedule_check;
ALTER TABLE etl_jobs DROP CONSTRAINT IF EXISTS etl_jobs_snapshot_check;
UPDATE etl_pipelines SET schedule_config = schedule_config - ARRAY['cronPreset','scheduleDescription','concurrency'];
UPDATE etl_jobs SET configuration_snapshot = jsonb_set(configuration_snapshot, '{scheduleConfig}',
  (configuration_snapshot->'scheduleConfig') - ARRAY['cronPreset','scheduleDescription','concurrency'])
WHERE configuration_snapshot IS NOT NULL;
ALTER TABLE etl_pipelines ADD CONSTRAINT etl_pipelines_schedule_check CHECK (etl_valid_schedule(schedule_config) IS TRUE);
ALTER TABLE etl_jobs ADD CONSTRAINT etl_jobs_snapshot_check CHECK (((configuration_snapshot IS NULL) AND (pipeline_id IS NULL)) OR (((jsonb_typeof(configuration_snapshot) = 'object'::text) AND ((configuration_snapshot - ARRAY['connection'::text, 'schemaMapping'::text, 'scheduleConfig'::text]) = '{}'::jsonb) AND etl_valid_connection((configuration_snapshot -> 'connection'::text)) AND etl_valid_mapping((configuration_snapshot -> 'schemaMapping'::text)) AND etl_valid_schedule((configuration_snapshot -> 'scheduleConfig'::text))) IS TRUE));
ALTER TABLE etl_jobs DROP CONSTRAINT IF EXISTS etl_jobs_rows_check;
ALTER TABLE etl_jobs ADD CONSTRAINT etl_jobs_rows_check CHECK ((total_rows >= 0) AND (processed_rows >= 0) AND (discarded_rows >= 0) AND (inserted_rows >= 0) AND (inserted_rows <= processed_rows) AND (((processed_rows)::bigint + discarded_rows) <= total_rows));
-- Refuse pre-existing duplicate offers instead of deleting any data automatically.
ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_offer_key;
ALTER TABLE routes ADD CONSTRAINT routes_offer_key UNIQUE NULLS NOT DISTINCT (origin_id,destination_id,airline_id,airline_code,codeshare,stops);
COMMIT;
