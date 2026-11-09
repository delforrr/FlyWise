# Verificación del ticket 03

Admin → Operaciones permite consultar, crear y editar operaciones finalizadas, ver el historial paginado, archivar y restaurar. Los cambios administrativos registran la versión y el actor. Para liberar una corrección, la acción «Volver a la última fuente» recupera la observación conservada. Una operación archivada requiere restauración explícita antes de esa acción.

La consulta `/api/metricas/rutas` combina los contadores de las aerolíneas para una ruta dirigida y un mes UTC. El worker BullMQ procesa los grupos pendientes en una única transacción. Un cálculo válido conserva su fecha y valor mientras espera la actualización. Una población que todavía no se calculó tiene fecha nula. La publicación sustituye contadores, fuentes y fecha al mismo tiempo.

La migración incremental `20261108_operaciones_metricas.sql` conserva los datos anteriores, toma una observación inicial para las operaciones existentes y marca sus grupos para recálculo. Se aplicó en `flywise_db` con PostgreSQL/PostGIS y Redis locales. El backfill encontró cero operaciones previas.

Los ciclos de prueba observaron el fallo inicial por la ausencia de la interfaz HTTP y de la pantalla, la aceptación indebida de `fechaVuelo: null` en PATCH y la fecha de cálculo adelantada para una población pendiente. La prueba HTTP con jobs reales cubre permisos, validación, conflicto de versión, historial, protección, recuperación de la fuente, archivo, cambios de mes, frontera de 15 minutos, anticipos, cero, ausencia de denominador y agregación por contadores. Los datos del test se revierten al terminar y la cola de Redis usa un nombre de prueba único.

La revisión independiente señaló que el cálculo por lotes podía publicar dos períodos afectados en generaciones distintas. La publicación usa una sola sentencia SQL y el mismo bloqueo transaccional que las mutaciones. Se corrigieron además la demora inicial del formulario, los períodos del primer siglo, la cardinalidad de páginas vacías, la conservación del archivo al recuperar una fuente y la observación incluida en el historial de importación.

El Quality Gate aprobó `npm run build` en backend y frontend, y `tsc --noEmit` para el último ajuste de validación. `npm test` pasó 209 casos de backend y 212 de frontend. Las suites E2E `vuelos-metricas`, `data-model`, `app` y `startup` pasaron 14 casos en total. ESLint y `git diff --check` pasaron. Para Vitest en el worktree se habilitó temporalmente el acceso al directorio real de dependencias que contiene el worker MapLibre. La configuración se restauró al terminar.

En navegador, sobre la rama de integración, se corrigió el selector de resultado que Reka rechazaba al hidratar por usar un valor vacío. Se comprobó que «Cancelado» y «Todos los resultados» se pueden elegir y consultar, y que se puede navegar de Operaciones a BTS. La regresión de Vitest verifica que «Todos» no se envía como estado al backend.
