# 03: Rechazar códigos ambiguos

**What to build:** Las consultas por códigos compartidos rechazan la ambigüedad sin seleccionar una entidad arbitraria.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Regresión HTTP: 200 antes, 409 después para dos aeropuertos o aerolíneas con código compartido.

