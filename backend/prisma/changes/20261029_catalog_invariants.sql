BEGIN;
-- Adding these checks validates existing rows and rolls back on inconsistent data.
ALTER TABLE users ADD CONSTRAINT users_email_canonical_check CHECK (email = lower(btrim(email)) AND email ~ '[^[:space:]]');
ALTER TABLE countries ADD CONSTRAINT countries_name_check CHECK (name ~ '[^[:space:]]');
ALTER TABLE countries ADD CONSTRAINT countries_iso_check CHECK (iso_code IS NULL OR iso_code ~ '^[A-Z]{2}$');
ALTER TABLE airports ADD CONSTRAINT airports_name_check CHECK (name ~ '[^[:space:]]' AND country_name ~ '[^[:space:]]');
ALTER TABLE airports ADD CONSTRAINT airports_codes_check CHECK ((iata IS NULL OR iata ~ '^[A-Z]{3}$') AND (icao IS NULL OR icao ~ '^[A-Z0-9]{4}$'));
ALTER TABLE airlines ADD CONSTRAINT airlines_name_check CHECK (name ~ '[^[:space:]]');
ALTER TABLE airlines ADD CONSTRAINT airlines_codes_check CHECK ((iata IS NULL OR iata ~ '^[A-Z0-9]{2}$') AND (icao IS NULL OR icao ~ '^[A-Z0-9]{3}$'));
ALTER TABLE routes ADD CONSTRAINT routes_airline_code_check CHECK (airline_code IS NULL OR airline_code ~ '^[A-Z0-9]{2,3}$');
COMMIT;
