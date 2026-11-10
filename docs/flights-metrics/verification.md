# Verificación de implementación

## Entorno

Rama `feature/fuentes-vuelos-metricas`. Dependencias backend restauradas desde lockfile, sin cambios al lockfile.

El ticket 01 se verificó inicialmente en `flywise_metrics_test`. Por pedido del usuario, la aplicación y las validaciones del ticket 02 pasaron a la base real `flywise_db`, con PostgreSQL/PostGIS y Redis en Docker. Las migraciones de nombres en español ya estaban mergeadas en Git, pero faltaban en esa base local: se aplicaron los cambios incrementales pendientes y `20261108_identidades_fuente.sql`.

Antes de migrar se guardó un respaldo en `C:\Users\delfo\AppData\Local\Temp\flywise-before-metrics-20261108.dump`. Se conservaron los usuarios y las configuraciones existentes. Los E2E usan transacciones con rollback; las cargas completas desde Admin quedan persistidas.

## Ticket 01

Refactor de adaptación OpenFlights sin cambio funcional; conserva sus pruebas existentes. Compilación backend/frontend aprobada. Backend: 34 suites, 209 tests. Frontend: 32 suites, 208 tests. E2E de identidad/importación: 19 casos aprobados. ESLint aprobado. Commit `6a71a56`.

## Ticket 02

Adapter OurAirports para `countries.csv` y `airports.csv`, sin `regions.csv`. Lectura por streaming y persistencia por lotes; países ISO y aeropuertos pequeños, medianos y grandes. Instalaciones excluidas y filas inválidas se contabilizan como descartes. Identidades por fuente separadas del ID OpenFlights y resolución explícita de casos ambiguos desde Admin.

Las pruebas cubren enriquecimiento sin cambiar el ID OpenFlights, ediciones protegidas, importación OurAirports antes de OpenFlights, ambigüedad por códigos y dos identidades compitiendo por un aeropuerto dentro del mismo lote. La resolución se verifica mediante HTTP autenticado como administrador. Se observó el fallo inicial del job con la fila OurAirports descartada antes de implementar el adapter; luego pasó ese comportamiento.

Quality Gate final:

- Backend: `npm run build`; 34 suites y 209 tests mediante `npm test`.
- Frontend: `npm run build`; 32 suites y 209 tests mediante `npm test`.
- E2E: `ourairports`, `identidad-importacion`, `administracion-catalogos` y `reglas-backend`: 4 suites, 23 casos aprobados contra PostgreSQL/Redis reales.
- ESLint de los archivos backend modificados y revisión de whitespace con Git.

La revisión independiente detectó duplicados al importar OpenFlights después de OurAirports, filtrado incorrecto por ciudad, mapeo manual en una fuente nativa y persistencia lenta por fila. Se corrigieron con reconciliación conservadora, búsqueda del servidor, mapeo nativo y SQL parametrizado por lote. También se corrigió la colisión entre dos IDs OpenFlights del mismo lote y se agregó su regresión E2E. El último intento de repetir la revisión independiente quedó impedido por el límite de uso del agente; esa corrección final se revisó localmente y pasó el Quality Gate.

## Validación real y navegador

Se cargaron los catálogos OpenFlights versionados en la base real, seguidos por OurAirports desde Admin. Países: 249 procesados, sin descartes. Aeropuertos: 86.347 filas leídas, 48.072 procesadas y 38.275 descartadas. La ejecución completa final terminó en el primer intento en 5,321 segundos, frente al timeout observado con la persistencia anterior por fila. Es una medición local, no un benchmark de producción.

Con autorización explícita del usuario se repararon 308 aeropuertos afectados por asociaciones incompatibles de la primera carga: se restauraron sus valores desde OpenFlights versionado y sus correspondencias OurAirports quedaron pendientes. No se borraron aeropuertos ni se modificaron usuarios o ediciones protegidas. La comprobación posterior encontró cero aeropuertos asociados a múltiples identidades OurAirports.

Con la aplicación compilada levantada en `localhost:3000` y backend en `localhost:3001`, se verificaron login administrativo, estado de las ingestas, edición y guardado de OurAirports sin mapeo manual, pendientes paginados y búsqueda por ciudad. Buscar `New York` devuelve JFK y LaGuardia aunque sus nombres no contengan la ciudad. La escritura de resolución está cubierta por el E2E transaccional; no se vinculó deliberadamente una instalación incorrecta en la base real. La consola del navegador no registró errores ni advertencias en esa sesión.

Evidencia local: `C:\Users\delfo\.codex\visualizations\2026\11\08\01a1b92c-26f5-7883-81ef-c6aa875a0dbc\ticket02-admin.png`.

Se eliminó exclusivamente la cuenta administrativa temporal creada para esta validación. Las cuentas originales se conservaron.

## Cierre de v1

La evidencia de los tickets integrados se conserva por separado.

- [Operaciones y métricas](verification-03.md)
- [Ingesta mensual BTS](verification-04.md)
- [Actividad ANAC](verification-05.md)
- [Indicadores EUROCONTROL](verification-06.md)
- [OTP en el mapa](verification-07.md)

La [guía de Admin](admin-validation.md) describe la validación desde la aplicación.

Los [flujos](flows.md) y el [modelo de datos](../dataModel.mermaid) representan el código implementado; el [spec](spec.md) describe el alcance objetivo.
