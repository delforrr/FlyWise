BEGIN;
ALTER TABLE etl_jobs ADD COLUMN attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0);
ALTER TABLE etl_discarded_samples ADD COLUMN attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0);
ALTER TABLE etl_job_events ADD COLUMN attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0);
COMMIT;
