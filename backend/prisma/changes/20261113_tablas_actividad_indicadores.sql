BEGIN;
ALTER TABLE actividad_anac_revisiones RENAME TO actividad_revisiones;
ALTER TABLE actividad_anac_publicaciones RENAME TO actividad_publicaciones;
ALTER TABLE actividad_anac_movimientos RENAME TO movimientos_aeropuerto;
ALTER TABLE eurocontrol_instantaneas RENAME TO indicadores_instantaneas;
ALTER TABLE indicadores_instantaneas DROP CONSTRAINT eurocontrol_instantaneas_producto_check;
ALTER TABLE indicadores_instantaneas ADD CONSTRAINT indicadores_instantaneas_producto_check CHECK (length(btrim(producto)) > 0);
COMMIT;
