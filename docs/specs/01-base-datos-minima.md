# SPEC-01 · Base de datos mínima sin reglas de negocio

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

La persistencia mezcla reglas de negocio, campos de proveedor y datos sin relación con confiabilidad. Cambiar un proveedor o una regla exige modificar múltiples lugares y arriesga la coherencia del histórico.

## Solution

Mantener un modelo común de operaciones finalizadas inmutables por ejecución, trazabilidad de cargas e integridad estructural en PostgreSQL.

## User Stories

1. Como administrador, quiero que la ingesta conserve la evidencia recibida en cada ejecución, para que los resultados se calculen sobre datos de fuente.
2. Como usuario, quiero que cada operación pertenezca al período correcto, para comparar puntualidad sin mover vuelos demorados al mes siguiente.
3. Como administrador, quiero consultar métricas de períodos fuera de la ventana del mapa y conocer la ejecución que respalda cada publicación vigente.
4. Como desarrollador, quiero validaciones compartidas por los adaptadores para preservar las mismas invariantes de dominio.
5. Como administrador, quiero resolver identidades externas sin cambiar IDs internos, para sustituir proveedores.
6. Como usuario, quiero que faltantes de horarios no se inventen, para que la métrica tenga evidencia real.
7. Como administrador, quiero que se retiren pasajeros y datos ajenos a confiabilidad, para reducir mantenimiento.
8. Como desarrollador, quiero migraciones verificadas y reversibles por etapas, para conservar relaciones y trazabilidad de las cargas.

## Implementation Decisions

- Eliminar CHECK de negocio y funciones/triggers propios después de cubrir cada regla en backend. Conservar PK, FK, unicidad, NOT NULL, índices, transacciones y PostGIS SRID 4326. Las validaciones de DTO no sustituyen invariantes de dominio en workers.
- Elegibilidad, clasificación OTP y autoridad de publicación se deciden en TypeScript. SQL parametrizado puede filtrar, persistir, sumar clasificaciones ya calculadas y ejecutar operaciones espaciales; no duplicar fórmulas de negocio en CASE SQL.
- Operación finalizada: ARRIVED, CANCELLED o DIVERTED confirmado como resultado final. Landed no demuestra llegada a puerta; una señal de desvío en progreso tampoco prueba finalización. No persistir operaciones en progreso como vuelos.
- Conservar los cuatro horarios disponibles como instantes UTC completos. Derivar período desde salida programada en zona del origen. Para fuentes sin instante, conservar fecha operativa informada como alternativa explícita. No inferir horarios desde demora ni usar salida real para reasignar el mes.
- La zona horaria aplicable debe resolverse de catálogo o de evidencia explícita del proveedor y quedar reproducible. Una corrección futura del catálogo no debe cambiar silenciosamente períodos históricos.
- Trasladar idOpenflights a correspondencias de identidad; conservar el texto de país pendiente de resolución fuera del dato canónico cuando sea posible. Retirar cantidadRutas como contador mutable; obtenerlo en consulta y cachear solo con medición.
- Conservar coordenadas y geometría por su uso PostGIS, con escritura atómica en backend. Retirar el comentario obsoleto que atribuye esta escritura a un trigger.
- Retirar pasajeros, PAX, matrícula y aeronave sin consumidor de confiabilidad. Retirar también filtros, DTO, fixtures y pantallas exclusivos. No borrar evidencia histórica sin migración revisada.
- Conservar protección manual y archivo en el catálogo. Retirar el historial y los campos de edición manual de vuelos mediante migración revisada. Reutilizar `ejecuciones_etl`, `vuelos` y `metricas_ruta`. La clave de fuente es única por ejecución. La métrica vigente se identifica por origen, destino, operadora y mes y referencia la ejecución que la respalda. Esa ejecución y la población identifican las filas usadas, sin tabla de miembros ni tabla de operaciones por proveedor.
- Inventariar también fuentes duplicadas en catálogo, banderas de vinculación inferida, activa frente a archivado, demoras frente a horarios, instantáneas repetidas y configuraciones específicas de proveedor. Una candidatura no autoriza borrar sin identificar consumidores y sustitución.

## Testing Decisions

- Usar endpoints de administración e importación con PostgreSQL real aislado; precedentes: invariantes de catálogo, reglas de backend, identidad de importación, concurrencia y vuelos-métricas.
- Probar referencias inválidas, duplicados concurrentes dentro de una ejecución y evidencia distinta del mismo vuelo en una ejecución posterior. Migrar fixtures con país no resuelto, protección del catálogo y códigos compartidos.
- Probar medianoche, cambio de mes/año, zona horaria y horario de verano, fuentes con solo fecha/demora y estados sin horarios reales.
- Comparar recuentos y relaciones antes/después de migración; inspeccionar catálogos PostgreSQL para verificar ausencia de triggers/funciones propios y CHECK retirados.

## Out of Scope

Quitar PostGIS o integridad referencial; datos en vivo; purga por ventana del mapa; eliminar columnas sin evidencia de consumidores.

## Further Notes

La base conserva los períodos publicados fuera de la ventana del mapa. Las filas antiguas se conservan durante la promoción. Su limpieza posterior se rige por retención y solo procede si ninguna población vigente referencia la ejecución y esta no puede volver a promoverse. La reconstrucción de revisiones sustituidas depende de las entradas retenidas y queda fuera de la garantía. Respetar los límites contractuales del proveedor.

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
