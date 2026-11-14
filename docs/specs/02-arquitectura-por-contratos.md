# SPEC-02 · Arquitectura limpia por contratos

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

Métricas y publicación conocen proveedores concretos y contienen reglas repetidas. Esto dificulta sustituir fuentes y probar una definición única de confiabilidad.

## Solution

Separar dominio, casos de uso, puertos e infraestructura. Los adaptadores traducen datos; FlyWise valida, calcula y publica con reglas propias.

## User Stories

1. Como usuario, quiero una misma definición de puntualidad para todas las fuentes, para comparar resultados.
2. Como administrador, quiero cambiar proveedor sin duplicar operaciones en el cálculo, para mantener resultados confiables.
3. Como desarrollador, quiero probar métricas sin OAG, BTS, Redis o HTTP, para aislar sus reglas.
4. Como desarrollador, quiero incorporar un proveedor implementando un contrato, para no editar el servicio de métricas.
5. Como administrador, quiero preservar la publicación anterior ante fallos, para mantener disponible la aplicación.
6. Como administrador, quiero conocer la cobertura real, para no confundir una muestra con toda la red.
7. Como usuario, quiero distinguir una ruta sin datos de una puntualidad de cero, para interpretar el mapa.
8. Como administrador, quiero identificar la ejecución, la población y la versión de cálculo que respaldan la métrica vigente.

## Implementation Decisions

- El dominio no importa NestJS, Prisma, Redis, BullMQ ni proveedores. Casos de uso dependen de puertos propios; el punto de composición NestJS enlaza implementaciones mediante tokens de inyección.
- Puertos mínimos orientados a necesidades: lectura normalizada por lotes, persistencia de operaciones por ejecución, consulta y promoción de métricas, y planificación/encolado. No crear una interfaz por clase ni un repositorio genérico universal.
- El módulo de puntualidad decide elegibilidad, clasificación y acumulación a partir de operaciones con evidencia normalizada. Ingesta selecciona el adaptador instalado según su capacidad y configuración validada. Métricas no depende de formatos externos, proveedores concretos ni colas.
- Los adaptadores resuelven paginación, protocolo y traducción de la evidencia recibida. Ingesta valida referencias de catálogo, alcance, identidad dentro de la fuente y fin de descarga. Las operaciones aceptadas son inmutables dentro de su ejecución. La infraestructura implementa transacciones y persistencia.
- OTP FlyWise v1: el denominador suma llegadas con evidencia suficiente y desvíos finales. Una llegada elegible con demora <=15 minutos es puntual. Los desvíos finales no son puntuales. Cancelados y llegadas con evidencia insuficiente quedan fuera del denominador y se informan por separado. Denominador cero produce Sin datos.
- Comparar precisión temporal disponible sin redondear hacia abajo un 15:01. Una fuente con minutos enteros conserva esa precisión y su procedencia. No promediar porcentajes de operadores: sumar numeradores y denominadores.
- Una fuente publicada por población (origen, destino, operadora, mes), con OAG como predeterminado y sin mezcla ni fallback automático. La fuente vigente se deriva de la ejecución publicada. Si la candidata proviene de otro proveedor, exigir autorización explícita de cambio para esa población y guardarla en la configuración capturada de la ejecución. Seleccionar un proveedor para descargar no autoriza el cambio. Los códigos compartidos no duplican la operación de la operadora.
- Insertar cada candidata en las tablas comunes con su propio `ejecucion_etl_id`. Por población, una carga validada como reemplazo completo actualiza atómicamente los conteos y `ejecucion_publicada_id` en `metricas_ruta`. Una carga parcial, fallida o con cobertura incierta conserva la publicación vigente. Un vacío validado para el alcance completo publica Sin datos. Una rectificación del proveedor se incorpora con otra ejecución.
- Operaciones y métricas son de solo lectura para Admin y sus endpoints. Retirar alta, edición, retiro/restauración manual, conciliación e historial por operación. Conservar trazabilidad por ejecución y publicación: fuente, alcance, conteos, motivos de descarte y versión de cálculo.
- Admitir en PostgreSQL como máximo una ingesta de operaciones de vuelo pendiente, en curso o pendiente de promoción para todo FlyWise. Manual y cron usan la misma admisión atómica. Una solicitud manual en conflicto devuelve HTTP 409 con el ID activo. El cron omite el disparo y registra el motivo. La exclusión se conserva durante reintentos y recuperación hasta publicar o cerrar definitivamente sin promoción. No se mantiene una transacción durante llamadas externas.
- La ingesta solicita cálculo durable y asíncrono. Antes de cambiar la publicación, verificar dentro de la transacción que la ejecución siga habilitada para promoverse y que tenga autorización si cambia la fuente vigente. Un intento tardío de una ejecución cerrada no puede publicar.
- ANAC/EUROCONTROL no se convierten en operaciones OTP. Conservar solo capacidades con aporte explícito a confiabilidad; separar indicador externo de OTP FlyWise y retirar productos exclusivamente de pasajeros/actividad.

## Testing Decisions

- El punto principal es el recorrido HTTP administrativo -> ejecución -> consulta pública de métricas; precedentes OAG, BTS, vuelos-métricas, mapa y contexto.
- Un conjunto de casos de contrato sintéticos debe pasar para OAG y BTS: duplicados, cancelación, desvío final, falta de evidencia y reintento.
- Probar 15:00 y 15:01, llegada puntual con otra sin evidencia, denominador cero y ponderación. En PostgreSQL, probar admisión concurrente manual/cron entre proveedores, recuperación de la ejecución activa, reemplazo completo con cambio atómico de conteos y referencia, fallo de página, vacío verificado, intento tardío y cambio de fuente con y sin autorización.
- Verificación estática de importaciones prohibidas complementaria; no sustituye pruebas de comportamiento.

## Out of Scope

Framework genérico de plugins remotos, API arbitraria por URL, microservicios, bus de eventos nuevo por defecto, cambiar metodología al estándar de un proveedor.

## Further Notes

Se diseña desde responsabilidades, no desde los nombres actuales. El primer recorrido OAG puede tener acoplamiento transitorio explícito, que se retira antes de cerrar esta spec.

Ver [diagrama de clases](../diagrams/02-clases.mermaid), [DER](../diagrams/02-dominio.mermaid) y [secuencia de publicación](../diagrams/03-carga-publicacion.mermaid).

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
