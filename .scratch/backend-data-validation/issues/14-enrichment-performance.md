# 14: Acotar el enriquecimiento de operadores por lote

**What to build:** La doble importación del catálogo real termina dentro del límite existente y conserva el enriquecimiento inequívoco e idempotente.

**Blocked by:** 04.

**Status:** completed

- [x] Evitar repetir la comprobación de unicidad del operador para cada oferta candidata.
- [x] Doble importación de los .dat sin duplicados y con enriquecimiento correcto, sin aumentar el timeout de 120 segundos.
- [x] Build y tests verdes; commit atómico.

**Evidence:** La regresión E2E agotó 120 segundos. pg_stat_activity mostró el UPDATE de enriquecimiento activo; sin espera de locks.

**Evidence and review:** La doble importación real pasó en 27 segundos frente al timeout de 120 previo. Se conservan enriquecimiento, descartes e idempotencia.

