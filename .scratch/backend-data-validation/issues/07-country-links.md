# 07: Actualizar relaciones de país inferidas

**What to build:** Correcciones del país actualizan vínculos inferidos y respetan vínculos explícitos.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Regresión PostgreSQL: corrección de país actualiza aeropuerto y aerolínea inferidos; relación explícita permanece intacta. Históricos sin procedencia se preservan.

