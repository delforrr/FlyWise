# 11: Validar configuración de arranque

**What to build:** Puertos inválidos, configuración esencial vacía y secretos JWT inadecuados se detectan antes de iniciar.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Diez configuraciones inválidas aceptadas antes son rechazadas después. Proceso real del backend compilado falla antes de iniciar HTTP con puerto 0. Los errores omiten valores.

