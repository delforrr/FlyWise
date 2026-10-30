# 08: Asegurar coherencia de jobs finalizados

**What to build:** Un job completado exige fechas y contadores consistentes también frente a escrituras SQL.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Regresión SQL rechaza finalización sin fechas o sin filas contabilizadas; permite finalización consistente. Worker real completa correctamente.

