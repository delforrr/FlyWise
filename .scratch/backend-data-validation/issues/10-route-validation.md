# 10: Unificar validación de consultas y selección de rutas

**What to build:** Consultas IATA e ICAO tienen un contrato claro; extremos iguales se rechazan y la interfaz evita seleccionarlos.

**Blocked by:** 01, 03.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** HTTP con PostgreSQL cubre formatos inválidos, equivalencia IATA/ICAO, extremos iguales y consulta válida. Test del estado usado por v-model detecta y previene PKN hacia PKN.

