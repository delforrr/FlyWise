# 12: Eliminar validaciones obsoletas y documentar decisiones

**What to build:** Se retiran DTOs sin consumidores y redundancias; se conservan reglas deliberadas del catálogo y operaciones.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Sin consumidores de SigninRequestDto; se eliminan DTO y decoradores redundantes. Formato requerido por lint; tipos de tests corregidos; contrato canónico firmado y db verify verde.

