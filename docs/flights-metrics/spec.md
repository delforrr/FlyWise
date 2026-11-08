# Métricas y operaciones de vuelo v1

Estado: alcance aprobado; implementación por tickets. Las verificaciones y limitaciones se registran en `verification.md`.

## Problem Statement

El explorador muestra rutas históricas sin puntualidad observada. La administración sólo gestiona catálogos; no permite corregir operaciones ni conocer cobertura, calidad o actualidad de métricas. Las fuentes tienen identidades, formatos y granularidades diferentes.

## Solution

Incorporar catálogos OurAirports, operaciones BTS, actividad ANAC e indicadores nativos EUROCONTROL. Administrar operaciones finalizadas con historial y protección manual. Calcular OTP mensual y mostrarlo al final en el mapa por mes/aerolínea; desconocido sigue siendo gris.

## User Stories

1. Como administrador, quiero conservar las cargas OpenFlights existentes para mantener el catálogo.
2. Como administrador, quiero enriquecer aeropuertos y países con OurAirports para mejorar geografía y referencias.
3. Como administrador, quiero resolver identidades ambiguas sin fusionar aeropuertos distintos.
4. Como administrador, quiero importar un mes BTS completo para calcular resultados observados.
5. Como administrador, quiero programar, pausar y ejecutar cargas para controlar sus actualizaciones.
6. Como administrador, quiero conocer intentos, errores y descartes para corregir problemas de cobertura.
7. Como administrador, quiero reintentar sin duplicar operaciones.
8. Como administrador, quiero crear operaciones manuales finalizadas con procedencia explícita.
9. Como administrador, quiero editar una operación sin que una reimportación borre mi corrección.
10. Como administrador, quiero consultar el historial y volver al dato de la fuente.
11. Como administrador, quiero archivar y restaurar operaciones sin perder trazabilidad.
12. Como administrador, quiero ver las métricas recalculadas después de una corrección.
13. Como usuario, quiero conservar el último cálculo válido mientras se actualiza, con su estado visible.
14. Como administrador, quiero consultar actividad y pasajeros ANAC distinguiendo movimientos de vuelos.
15. Como administrador, quiero consultar EUROCONTROL con su metodología, atribución y período propios.
16. Como usuario del mapa, quiero seleccionar mes y aerolínea para conocer la puntualidad de una ruta.
17. Como usuario, quiero conocer muestra y fuentes para interpretar un porcentaje.
18. Como usuario, quiero distinguir cero puntualidad de ausencia de información.

## Implementation Decisions

- Adapter por familia: catálogos, operaciones, movimientos e indicadores. Reutilizar la normalización OpenFlights. No introducir Bridge ni un proveedor universal con métodos opcionales.
- Dominio independiente de HTTP y formatos externos; aplicación orquesta casos de uso; infraestructura implementa lectura/persistencia; NestJS inyecta dependencias. No introducir repositorios genéricos.
- Mantener módulos de catálogos, rutas, autenticación y ETL; incorporar vuelos, métricas, actividad e indicadores según responsabilidad.
- Reutilizar Vuelo y MetricaRuta. Añadir historial, versión, protección, archivo y última observación de fuente; las altas manuales no inventan una ejecución ETL.
- Correspondencias explícitas de identidades externas. OurAirports no ocupa idOpenflights. Coincidencias ambiguas requieren resolución administrativa.
- OurAirports prevalece en geografía/país; protección manual prevalece sobre toda fuente. OpenFlights conserva aerolíneas y ofertas históricas.
- Operaciones ARRIVED requieren demora entera conocida, incluidos anticipos; CANCELLED/DIVERTED guardan demora nula. No se administran programados ni activos.
- OTP FlyWise: ARRIVED y demora <=15. Denominador: total menos cancelados; desvíos no son puntuales. Agregar contadores, nunca porcentajes. Sin denominador: null.
- Las operaciones manuales participan con procedencia visible. Las ediciones/archivo/restauración recalculan combinaciones anteriores y nuevas; publicación atómica, último valor válido marcado mientras esté pendiente.
- Administración sólo ADMIN. DTOs estrictos, versiones para conflictos, paginación 20/máximo 100 y filtros de período/extremos/operador/resultado/fuente/archivo.
- Cargas manuales y programadas UTC, mensuales para operaciones/actividad/indicadores y diarias para OurAirports. Sin backfill histórico masivo automático.
- Node Streams y lotes 1000–5000, reintentos acotados, hosts autorizados, límites de descarga/descompresión y métricas de ejecución. No publicar coberturas parciales como completas.
- ANAC conserva movimientos, calidad y semántica Pasajeros/PAX. No inferir OTP, ocupación ni cancelaciones.
- EUROCONTROL conserva indicadores publicados, contadores, períodos y snapshots con copyright/disclaimer. No recomponer públicamente ni convertir missing schedules en cancelaciones. Rankings DY/WK/Y2D se interpretan independientemente.
- El mapa agrega ruta dirigida/mes y permite aerolínea. Verde >85, amarillo 60–85, rojo <60, gris null. Inicialmente último mes BTS completo; EUROCONTROL no colorea rutas.

## Testing Decisions

Puntos aprobados: HTTP y ejecución de jobs con PostgreSQL/PostGIS y Redis reales, fixtures de proveedores y pantallas afectadas. Probar comportamiento, no detalles privados. Reutilizar pruebas de catálogos, pipelines, intentos, autenticación y mapa. Red externa sólo smoke independiente.

Cubrir 15 minutos exactos, anticipos, cancelaciones/desvíos, desconocidos, autorización, concurrencia, cambios de período, protección, archivo, reimportación, idempotencia, fallos parciales, identidad ambigua, formatos y granularidad, publicación atómica, mes BTS completo y colores del mapa. Quality Gate backend/frontend y E2E afectados antes de cada commit.

## Out of Scope

OAG y demás fuentes comerciales; regiones OurAirports, pistas, frecuencias y radioayudas; vuelos futuros/en curso; exportación PDF/Excel; OTP de ruta derivado de indicadores aeroportuarios; eliminación destructiva; push/merge autónomos.

## Further Notes

Ver investigación y smoke test en este directorio. La implementación tiene siete tickets aprobados con bloqueos explícitos. Se conservan los datos y la configuración actuales mediante migraciones incrementales.

## Glosario técnico

| Término | Significado |
| --- | --- |
| OTP / OTP-15 | On-Time Performance: proporción de operaciones puntuales según población y frontera declaradas. |
| BTS | Bureau of Transportation Statistics de Estados Unidos. |
| ANAC | Administración Nacional de Aviación Civil de Argentina. |
| EUROCONTROL | Organización europea de coordinación y análisis de navegación aérea. |
| IATA | International Air Transport Association; mantiene códigos comerciales aeronáuticos. |
| ICAO / OACI | International Civil Aviation Organization / Organización de Aviación Civil Internacional. |
| UTC | Tiempo Universal Coordinado. |
| ETL | Extracción, transformación y carga de datos. |
| API / HTTP | Interfaz programática / protocolo de solicitudes y respuestas web. |
| DTO | Objeto que define y valida datos de entrada o salida. |
| CRUD | Crear, consultar, actualizar y retirar registros. |
| CSV / XLSX / JSON | Texto tabular delimitado / libro Excel / formato estructurado de intercambio. |
| SOLID | Responsabilidad única, extensión sin alterar consumidores, sustitución válida, interfaces específicas y dependencia de abstracciones. |
| Clean Architecture | Separación de reglas de negocio respecto de transporte, frameworks y persistencia. |
| Adapter | Traducción de un contrato externo al contrato propio requerido por un consumidor. |
| Bridge | Separación de dos dimensiones de variación independientes; no necesario aquí. |
| Inyección de dependencias | Entregar colaboradores a un módulo desde su composición. |
| Stream / lote | Procesamiento incremental / grupo acotado de filas persistidas juntas. |
| Idempotencia | Repetir una operación no duplica sus efectos finales. |
| Snapshot | Copia identificable del estado de una fuente o cálculo en un momento. |
| SSRF | Ataque que intenta usar el servidor para acceder a destinos de red no autorizados. |
| Backoff | Espera creciente entre reintentos. |
| Codeshare | Comercialización del mismo servicio bajo códigos de distintas aerolíneas. |
| PostGIS / SRID 4326 | Extensión geográfica PostgreSQL / referencia espacial WGS84. |
| DY / WK / Y2D | Día / semana / acumulado desde comienzo del año, según EUROCONTROL. |
