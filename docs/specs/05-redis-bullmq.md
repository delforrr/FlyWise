# SPEC-05 · Redis y BullMQ: rendimiento y recuperación

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

Redis cumple funciones de caché, sesiones y colas, mientras los trabajos se reparten por proveedor. Una optimización indiscriminada puede perder trabajos, invalidar sesiones o mostrar métricas inconsistentes.

## Solution

Cachear lecturas medidas con publicación consistente y ejecutar cargas recuperables e idempotentes, separando políticas de caché de las necesidades de colas y autenticación.

## User Stories

1. Como usuario, quiero consultas rápidas del mapa y catálogos, para explorar fluidamente.
2. Como administrador, quiero que una carga validada termine reflejada en las lecturas, incluso si falla la notificación inicial.
3. Como administrador, quiero reintentar sin duplicar vuelos, para recuperar fallos.
4. Como administrador, quiero conocer progreso y descartes, para diagnosticar una carga.
5. Como usuario, quiero que una caída de caché no impida leer datos disponibles, para mantener continuidad.
6. Como administrador, quiero que reiniciar un worker no pierda publicaciones pendientes, para recuperar trabajo.
7. Como equipo, quiero medir latencia y memoria antes y después, para justificar las optimizaciones.
8. Como usuario, quiero que optimizar caché no debilite sesiones, para conservar control de acceso.

## Implementation Decisions

- Medir consultas candidatas, frecuencia, p50/p95, memoria, hit ratio y costo de invalidación. Priorizar catálogo/autocompletado, meses disponibles y métricas publicadas; no cachear todo.
- Cache-aside con TTL acotado y claves por parámetros normalizados, versión de contrato y revisión publicada. Invalidar o cambiar generación después del commit; un lector atrasado no puede reintroducir como vigente una revisión anterior.
- Si falla Redis de caché, consultar persistencia con límites de tiempo y carga; no extrapolar ese fallback a autenticación. Redis de sesiones conserva sus garantías de revocación.
- Redis usado por BullMQ requiere política noeviction. Separar instancia de caché si se adopta expulsión por memoria; bases lógicas distintas no aíslan la política de memoria. Antes de desplegar, medir y documentar límites.
- Reusar señal durable de métricas pendientes y recuperación existente antes de crear un outbox nuevo. Cubrir commit de datos seguido de caída al encolar; reiniciar debe recuperar pendientes.
- Idempotencia persistente de operaciones y promoción; jobId no sustituye deduplicación después de limpiar trabajos. Reintentos con backoff para fallos recuperables, sin reintentar indefinidamente validaciones/permisos.
- Streams y lotes de 1000–5000 filas con backpressure para datasets. Las páginas API pueden ser menores y no deben inflarse artificialmente. Dimensionar el trabajo dentro de cada ejecución según memoria y cuota.
- Planificación idempotente por servicio, edición/pausa sin schedulers duplicados y captura de configuración. Manual y cron comparten exclusión durable en PostgreSQL para ingestas de operaciones de vuelo. BullMQ ejecuta y reintenta el trabajo admitido. Ante conflicto, manual recibe HTTP 409 con el ID activo y cron omite el disparo con motivo registrado. Tras una caída, recuperar o cerrar la ejecución activa antes de admitir otra.
- El cron resuelve y captura el último mes calendario cerrado al inicio de cada ejecución. Las repeticiones solicitan una nueva candidata para ese mes. Solo una carga validada como reemplazo completo sustituye la publicación vigente. Probar cambio de mes/año y zona de planificación.
- Retención acotada de jobs completos/fallidos en Redis, auditoría duradera en base; cierre ordenado de workers y conexiones, métricas de aceptados/rechazados/tiempos y alarmas solo administrativas.

## Testing Decisions

- Usar PostgreSQL y Redis reales en integración, precedentes encolado real, intentos y vuelos-métricas; falsos de tiempo solo para límites deterministas.
- Probar lectura que rellena caché durante promoción, caída después de commit antes de enqueue, reintento tras limpieza de jobs, reinicio y pausa/reprogramación. Probar que dos admisiones simultáneas producen una sola ejecución y que el reinicio no libera la exclusión mientras quede trabajo recuperable.
- Benchmark reproducible con dataset, concurrencia, hardware y resultados antes/después; exigir mejora en la consulta elegida sin regresión funcional ni crecimiento de memoria con el dataset completo.
- Probar permisos/sesiones de forma independiente del fallback de caché.

## Out of Scope

Nueva plataforma de observabilidad, clúster distribuido sin evidencia de necesidad, promesa de exactly-once por BullMQ, TTL como única coherencia.

## Further Notes

Referencias oficiales consultadas el 14-11-2026: [producción BullMQ](https://docs.bullmq.io/guide/going-to-production), [idempotencia](https://docs.bullmq.io/patterns/idempotent-jobs), [retención de trabajos](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs), [cache-aside Redis](https://redis.io/docs/latest/develop/use-cases/cache-aside/). Verificar APIs contra las versiones instaladas antes de implementar.

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
