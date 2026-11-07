# FlyWise: mantenibilidad y separación de responsabilidades

Estado: aprobado para implementación. Verificación mediante HTTP y jobs ETL; tickets aprobados. Tracker externo no configurado.

## Problem Statement

El equipo necesita saber cuánto se aproxima FlyWise a una arquitectura por capas y reducir el esfuerzo de comprender y cambiar sus reglas. La inspección inicial encontró negocio, consultas y transformación de respuestas juntos; reglas de catálogo distribuidas entre administración e ingesta; y funciones y un trigger propios en PostgreSQL.

Estos son candidatos de mejora, no una auditoría completa ni defectos funcionales demostrados. Antes de refactorizar se necesita evidencia reproducible y una línea base de comportamiento. La auditoría y los resultados de ejecución se documentan en los informes de auditoría y verificación de esta entrega. Este spec conserva las decisiones aprobadas.

## Solution

Entregar primero una auditoría con resumen, hallazgos de lo transversal a lo local y mejoras mínimas. Cerrar con una revisión de N-Capas basada en responsabilidades y dependencias observables. Ejecutar después mejoras en cortes funcionales verificables, sin cambiar contratos públicos ni introducir repositorios genéricos.

Presentación, negocio y acceso a datos constituyen las capas de referencia. La ingesta es una entrada asíncrona que reutiliza negocio; la caché es infraestructura auxiliar. El frontend presenta información y los controladores HTTP adaptan solicitudes al backend.

## User Stories

1. Como mantenedor, quiero un diagnóstico con evidencia para priorizar cambios reales.
2. Como mantenedor, quiero distinguir defectos de oportunidades para no refactorizar por preferencias de estilo.
3. Como desarrollador, quiero términos consistentes para distinguir ruta, oferta, ejecución e intento.
4. Como desarrollador, quiero reglas compartidas entre HTTP y ETL para evitar comportamientos distintos.
5. Como administrador, quiero crear y editar aeropuertos sin perder su ubicación espacial.
6. Como usuario del mapa, quiero que las búsquedas espaciales reflejen las coordenadas vigentes.
7. Como administrador, quiero que las importaciones respeten las ediciones manuales.
8. Como administrador, quiero archivar catálogos conservando relaciones e historial.
9. Como usuario del mapa, quiero rutas visibles coherentes con sus aeropuertos, ofertas y operadores.
10. Como administrador, quiero que las configuraciones ETL inválidas sean rechazadas antes de ejecutarse.
11. Como administrador, quiero que errores de encolado y reintentos conserven estados y auditoría coherentes.
12. Como operador, quiero importar por streams y lotes sin cargar datasets enteros en memoria.
13. Como desarrollador, quiero aprovechar las APIs instaladas para evitar soluciones caseras equivalentes.
14. Como mantenedor, quiero SQL manual limitado a necesidades justificadas y parametrizado.
15. Como mantenedor, quiero reducir operaciones redundantes de persistencia sin perder transacciones.
16. Como operador, quiero retirar funciones y triggers propios sin perder datos ni garantías de integridad.
17. Como revisor, quiero pruebas de comportamiento que sobrevivan a reorganizaciones internas.
18. Como responsable técnico, quiero una matriz de cumplimiento por responsabilidad para evaluar N-Capas sin porcentajes arbitrarios.

## Implementation Decisions

- La auditoría precede a los refactors: máximo veinte hallazgos con caso concreto, evidencia, prioridad, solución mínima y consecuencia de posponerlo. Añadir un informe visual temporal antes/después de las principales oportunidades.
- Revisar mapa, catálogos, autenticación, ingesta, persistencia y configuración de ejecución. Declarar áreas no leídas y carga asumida; no atribuir capacidad de producción sin mediciones.
- Separar responsabilidades cuando concentre conocimiento y reduzca cambios coordinados. Conservar módulos útiles aunque sean pequeños; no agregar interfaces, patrones ni capas de delegación por cumplir una forma.
- Mantener contratos HTTP, roles, semántica de archivo, protección manual e historial. No migrar la versión de Prisma como parte de este trabajo.
- Contrastar cualquier sustitución de SQL con las capacidades de Prisma 8 RC instalado. No prometer eliminación total del SQL ni contar menos llamadas como mejora si empeora atomicidad o rendimiento.
- Retirar funciones y triggers propios de la aplicación. Conservar PostGIS, SRID 4326, claves foráneas, unicidad, índices y CHECK simples. Distancias y proximidad continúan en PostGIS.
- Trasladar la actualización de ubicación al backend cubriendo todos los escritores. Activar la nueva escritura y verificar equivalencia antes de retirar el trigger; no retirar primero la garantía existente.
- Trasladar validación ETL propia a entradas compartidas del backend. Revisar restricciones que dependen de funciones antes de eliminarlas; mantener restricciones declarativas independientes y adaptar fixtures internos.
- Concentrar reglas de escritura de catálogo y visibilidad solo cuando la auditoría confirme duplicación semántica. No introducir vistas o funciones propias como sustitución de las funciones que se eliminan.
- Concentrar el ciclo de ejecución ETL si se confirma que sus entradas duplican transiciones. Mantener contadores por lote dentro de su transacción y conservar errores y trazabilidad.
- Aplicar migraciones incrementales compatibles con instalaciones nuevas y existentes. Identificar escritores directos y adaptar scripts y pruebas; documentar que el SQL externo ya no ejecutará automáticamente reglas trasladadas.
- Cualquier ahorro de líneas o dependencias debe medirse; no estimarlo como resultado obtenido.

## Testing Decisions

- Decisión aprobada: utilizar HTTP y jobs como puntos de prueba principales, con base PostgreSQL/PostGIS real y verificación de las pantallas afectadas. Probar resultados observables, no nombres de helpers ni cantidad de clases.
- Aprovechar las pruebas existentes de administración, archivo, invariantes de catálogo, consultas globales, pipelines, intentos y validación. Las pruebas de pipelines actuales sustituyen el encolado: no presentarlas como integración completa con Redis.
- Aeropuertos: alta y cambio de coordenadas por administración e ingesta; valores límite válidos, rechazo de inválidos, ubicación SRID 4326 y proximidad coherente después de retirar el trigger.
- Catálogos: importación concurrente con edición manual, archivo y reintento; verificar protección, relaciones y contadores sin escrituras parciales.
- Rutas: comparar resultados de mapa y búsquedas con ofertas, aeropuertos y aerolíneas archivados; conservar orden, filtros y límites existentes.
- ETL: configuración inválida por HTTP y entrada interna, fallo de encolado, intento fallido y reintento exitoso; verificar estados, historial y métricas visibles.
- Migración: probar base nueva y actualización de una base con datos; comprobar ausencia de funciones y triggers propios y presencia de extensiones y restricciones conservadas.
- Antes de dar cambios por listos, verificar contenedores, compilación y tests de backend y frontend, pruebas de integración afectadas y estado Git. Informar bloqueos y resultados reales. No ejecutar scripts que regeneren archivos como si fueran verificaciones de solo lectura.

## Out of Scope

- Implementar OTP con nuevas fuentes, modificar UX, cambiar autenticación o agregar funcionalidades.
- Reescribir el sistema en arquitectura hexagonal estricta, reemplazar ORM o introducir infraestructura nueva.
- Eliminar PostGIS, integridad declarativa o SQL espacial necesario.
- Implementar refactors o publicar tickets durante la elaboración de este borrador.

## Further Notes

No había una especificación previa explícita de N-Capas ni un glosario localizado; esta entrega incorpora el glosario del dominio. La clasificación anterior valida y precisa la propuesta del usuario sin tratar caché e ingesta como capas secuenciales.

Los cortes y sus dependencias fueron aprobados. No se encontró configuración de tracker ni vocabulario de triage: ejecutar `/setup-matt-pocock-skills`. Tras configurar y aprobar, publicar el spec y los tickets con `ready-for-agent` y relaciones de bloqueo.

Implementación autorizada después de aprobar el spec y los siete cortes. Los resultados y límites están en `verificacion-mantenibilidad-n-capas.md`. El principal riesgo de despliegue es conservar escritores antiguos después de retirar el trigger.
