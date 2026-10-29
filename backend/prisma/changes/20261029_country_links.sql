BEGIN;
-- Legacy links have no provenance; preserve them rather than guessing ownership.
ALTER TABLE airports ADD COLUMN country_link_inferred boolean NOT NULL DEFAULT false;
ALTER TABLE airlines ADD COLUMN country_link_inferred boolean NOT NULL DEFAULT false;
COMMIT;
