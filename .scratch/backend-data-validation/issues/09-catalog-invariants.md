# 09: Reforzar invariantes del catálogo en PostgreSQL

**What to build:** Escrituras internas rechazan textos esenciales vacíos, códigos malformados y emails sin normalizar; la migración verifica datos previos sin borrarlos.

**Blocked by:** 04.

**Status:** completed

- [x] Comportamiento aprobado implementado en todas las capas afectadas.
- [x] Regresión verificada en la frontera pública acordada; E2E con servicios reales cuando corresponde.
- [x] Build y pruebas de ambos proyectos verdes antes del commit atómico.
- [x] Revisión del ticket y evidencia registradas.

**Evidence and review:** Checks aplicados transaccionalmente sin modificar registros anteriores. Escrituras SQL inválidas rechazadas; doble importación de los catálogos real verificada.

