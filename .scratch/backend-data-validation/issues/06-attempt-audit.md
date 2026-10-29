# 06: Separar auditoría por intento ETL

**What to build:** Contadores y muestras se identifican por intento sin perder la evidencia anterior.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** BullMQ y Redis reales procesan airlines.dat dos veces; PostgreSQL conserva muestras y eventos por intento. El monitor consulta el intento actual o uno anterior. Builds y suites de ambos proyectos verdes.

