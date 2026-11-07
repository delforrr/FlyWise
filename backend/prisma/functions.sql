-- Install extension types before creating tables. Business rules live in the backend.
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS postgis;
