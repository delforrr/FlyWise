# 04: Preservar códigos válidos ante actualizaciones inválidas

**What to build:** Una importación con códigos malformados conserva los valores válidos existentes y registra la incidencia.

**Blocked by:** 01.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Importaciones reales de países, aeropuertos y aerolíneas conservan códigos previos ante entrada inválida y los limpian ante ausencia explícita.

