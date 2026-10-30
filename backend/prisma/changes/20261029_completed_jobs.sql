BEGIN;
-- Validate legacy rows before publishing the constraint; never repair audit history silently.
ALTER TABLE etl_jobs ADD CONSTRAINT etl_jobs_completion_check
CHECK (status <> 'completed' OR (started_at IS NOT NULL AND finished_at IS NOT NULL AND total_rows::bigint = processed_rows::bigint + discarded_rows)) NOT VALID;
ALTER TABLE etl_jobs VALIDATE CONSTRAINT etl_jobs_completion_check;
COMMIT;
