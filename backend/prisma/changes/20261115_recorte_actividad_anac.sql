BEGIN;

ALTER TABLE movimientos_aeropuerto
  DROP COLUMN aeronave,
  DROP COLUMN matricula,
  DROP COLUMN pasajeros,
  DROP COLUMN pax;

COMMIT;
