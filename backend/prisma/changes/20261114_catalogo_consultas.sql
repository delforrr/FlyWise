BEGIN;
CREATE OR REPLACE VIEW cantidades_rutas_aeropuerto AS
WITH visibles AS NOT MATERIALIZED (
  SELECT r.origen_id, r.destino_id
  FROM rutas r
  JOIN aeropuertos o ON o.id=r.origen_id
  JOIN aeropuertos d ON d.id=r.destino_id
  WHERE r.archivado_en IS NULL AND o.archivado_en IS NULL AND d.archivado_en IS NULL
    AND EXISTS (
      SELECT 1 FROM ofertas_ruta f LEFT JOIN aerolineas a ON a.id=f.aerolinea_id
      WHERE f.ruta_id=r.id AND f.archivado_en IS NULL
        AND (f.aerolinea_id IS NULL OR a.archivado_en IS NULL)
    )
)
SELECT aeropuerto_id, count(*)::int AS cantidad
FROM (
  SELECT origen_id AS aeropuerto_id FROM visibles
  UNION ALL
  SELECT destino_id FROM visibles
) extremos
GROUP BY aeropuerto_id;
COMMIT;
