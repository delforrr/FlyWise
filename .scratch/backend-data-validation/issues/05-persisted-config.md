# 05: Revalidar configuraciones ETL persistidas

**What to build:** Configuraciones persistidas se validan antes de programar, encolar y ejecutar trabajos.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Persistencia real de un mapeo inválido: ejecución rechazada antes de encolar; reconciliación de arranque elimina su scheduler y conserva disponible la API.

