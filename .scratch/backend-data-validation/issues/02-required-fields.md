# 02: Validar obligatoriedad después de normalizar

**What to build:** Campos marcados obligatorios no pueden terminar vacíos o inválidos; los descartes explican el campo.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence:** Tres regresiones unitarias fallaron antes del cambio y pasaron después. E2E PostgreSQL confirma descarte, ausencia de escritura y motivo de isoCode. Revisión: cero y false permanecen valores válidos.


