# Modelo de datos de FlyWise v1

Contrato ejecutable: `backend/prisma/contract.prisma`. Relaciones y columnas: [diagrama Mermaid](dataModel.mermaid). Fuentes, cobertura y pasos para incorporar puntualidad: [reporte de datos](data-sources.md).

## Catálogos e identidades

`Country`, `Airport`, `Airline` y `Route` alimentan el mapa. Se conservan UUID internos y códigos externos opcionales. `openflightsId` es un identificador de OpenFlights, no una clave universal entre proveedores. IATA/ICAO están indexados y no se imponen como únicos a catálogos históricos.

Los países conservan sus relaciones opcionales y etiquetas originales. Solo se infiere una relación por nombre normalizado inequívoco; no se inventan equivalencias por similitud ni se pisan relaciones explícitas.

Una oferta de ruta es direccional. Su restricción `routes_offer_key` combina origen, destino, operador vinculado, código original, codeshare y escalas, usando `NULLS NOT DISTINCT`. Permite reintentar ofertas con operador desconocido sin duplicarlas. Una relación de operador ausente puede completarse antes del upsert cuando el código corresponde a un único operador; no se infieren relaciones ambiguas.

Se retiran `Route.distanceKm`, `Route.popularityScore` y el índice del score. PostGIS calcula las distancias por lote sobre los extremos vigentes; las millas náuticas se derivan. La consulta inicial se limita a 100 ofertas ordenadas por conectividad de origen, con desempate estable. `Airport.routeCount` permanece y se recompone con una agregación SQL después de importar rutas. No representa pasajeros ni frecuencia comercial.

`Airport.location` continúa como `geography(Point,4326)` con GiST y trigger de sincronización para todas las inserciones/actualizaciones. Se conservan latitud y longitud para el mapa; no se introduce un segundo mecanismo de sincronización.

## Ingesta y descartes

La ingesta local `all` ejecuta países → aeropuertos → aerolíneas → rutas. Usa streams, parser CSV instalado y lotes de 2.000 filas. Los pipelines configurados admiten lotes de 1.000 a 5.000. Escrituras masivas, actualización de progreso y muestras se confirman en una transacción por lote.

- `\N`, vacío y espacios representan ausencia. `-` y `N/A` se interpretan como ausencia en códigos, no en textos arbitrarios.
- No se exige IATA/ICAO para admitir un aeropuerto; sí nombre, identidad externa válida y coordenadas finitas en rango. Cero es una coordenada válida y no reemplaza un dato ausente.
- Las aerolíneas inactivas se importan. `active` puede ser nulo si se desconoce; el marcador `-1, Unknown` no crea una empresa ficticia.
- Los extremos de rutas se resuelven por ID; el código se usa como alternativa únicamente si es inequívoco. Un operador desconocido no invalida la ruta.
- Origen/destino irresolubles o iguales, escalas inválidas y campos esenciales inválidos generan descarte. Fallos de archivo, parser, red o base generan fallo de ejecución y reintento, no miles de descartes ficticios.
- Los catálogos se actualizan con upsert; no se eliminan entidades ausentes de una nueva descarga ni se reinicia la base.

Resultado verificado con los archivos incluidos:

| Archivo | Filas leídas | Procesadas | Descartadas |
| --- | ---: | ---: | ---: |
| countries.dat | 261 | 261 | 0 |
| airports.dat | 7.698 | 7.698 | 0 |
| airlines.dat | 6.162 | 6.161 | 1, marcador Unknown |
| routes.dat | 67.663 | 67.091 | 572 |

En rutas quedan 571 filas con algún extremo irresoluble y una oferta `PKN → PKN` con el mismo aeropuerto en ambos extremos. La segunda importación de rutas no inserta registros nuevos. Los ensayos automatizados se realizan con rollback. La carga operativa posterior se ejecuta por los cuatro pipelines de sistema y deja sus datos y auditoría en la base local.

## Constructor y auditoría ETL

`EtlPipeline` conserva configuración y archivo lógico; `EtlJob` representa una ejecución. El arranque crea cuatro configuraciones OpenFlights de sistema, manuales, sin importar automáticamente sus datasets. El constructor permite CSV/`.dat` por HTTP GET, cabecera opcional, delimitador y mapeo de campos canónicos. No ejecuta código arbitrario, JSON, POST, S3 ni importación de OTP en esta versión.

`scheduleConfig` guarda solo `cronExpression`, `batchSize`, `timeoutSeconds` y `maxRetries`. Se eliminan preset, descripción y concurrencia por pipeline. Cron vacío significa manual; BullMQ programa expresiones en UTC y limita globalmente la concurrencia del catálogo a 1. Pausar o archivar detiene la programación y nuevos disparos; las ejecuciones ya encoladas terminan. Al arrancar se reconcilia la programación de Redis con la configuración persistida.

Las conexiones solo admiten hosts HTTPS de `ETL_ALLOWED_HOSTS`; por defecto `raw.githubusercontent.com,davidmegginson.github.io`. No se siguen redirecciones ni se permiten URL con credenciales, query o fragmento. La descarga fija una dirección IPv4 pública comprobada. Los headers contienen `credentialRef`, autorizado mediante `ETL_ALLOWED_CREDENTIAL_REFS`; nunca un secreto literal. La UI no puede leer otras variables del servidor. El probe limita la lectura a 1 MiB y cinco registros.

Los DTOs con validación anidada verifican el contrato, las transformaciones y los destinos. PostgreSQL conserva comprobaciones estructurales JSON, bloqueo de credenciales literales, relaciones e invariantes de contadores. No duplica todo el motor de mapeo en SQL.

Cada job asociado a un pipeline captura un snapshot de configuración. Editar el pipeline no cambia ejecuciones anteriores. `sourceUri` y SHA-256 identifican la entrada descargada; reintentar es una ejecución completa sobre la fuente, sin reconstruir filas desde muestras truncadas.

`processedRows` cuenta filas válidas confirmadas, incluidas las ya existentes; `insertedRows` cuenta solo filas nuevas. Al completar, `totalRows = processedRows + discardedRows`; `insertedRows <= processedRows`. La duración se deriva de inicio/fin. En un fallo se conserva el último lote confirmado; un nuevo intento reinicia los contadores del intento y conserva sus eventos.

Se guardan hasta 100 muestras por job y 4.096 caracteres por muestra, con campo, motivo e índice de registro desde 1, sin cabecera. Las muestras remotas eliminan columnas sensibles y valores de credenciales referenciadas. No existe resolución manual ni reintento selectivo. El panel consulta el estado real y etiqueta sus totales como historial de ejecuciones, no cardinalidad del catálogo.

Endpoints protegidos con JWT: `GET /etl/status`, `GET /etl/history`, `POST /etl/trigger/:dataset`. El constructor exige además ADMIN: CRUD/archivo en `/etl/pipelines`, probe en `/etl/pipelines/probe`, ejecución en `/etl/pipelines/:id/run`, detalle/eventos/muestras en `/etl/jobs/:id` y reintento completo en `/etl/jobs/:id/retry`. Todos bajo el prefijo `/api`.

## Operaciones y puntualidad futuras

`Flight` y `RouteMetric` permanecen, sin importadores ni agregación activados. `Flight` usa identidad estable `(source, sourceRecordId)`. Una operación ARRIVED requiere demora, que puede ser negativa; CANCELLED y DIVERTED no admiten una demora de llegada al destino original.

La clave primaria mensual de `RouteMetric` es `(originId, destinationId, airlineId, period)`, con período en el primer día del mes. Se conservan contadores y suma de demora, no porcentajes redundantes. Según la definición actual del proyecto: operados = total menos cancelados; puntual = ARRIVED con demora <=15. Denominador cero produce NULL. Al combinar meses se suman contadores antes de dividir. Los históricos no dependen de la existencia de una oferta en `Route`.

El frontend usa IDs internos, códigos o nombres como etiquetas, consultas direccionales y métricas nulas con estilo neutro. No genera porcentajes ni series históricas. Las alternativas con escala quedan fuera de esta entrega. El reporte de fuentes explica qué hace falta para publicar OTP real y la diferencia de frontera con BTS.

## Instalación y evolución del esquema

Prisma 8 RC continúa fijado en el lockfile. Ejecutar `npm ci` y `npx prisma contract emit` dentro de backend antes de compilar. PostgreSQL y Redis deben estar activos. No utilizar `migrate reset` ni reconciliaciones que propongan eliminar `spatial_ref_sys`.

Para una base nueva: instalar `functions.sql`, ejecutar `prisma db init --db "$DATABASE_URL"`, instalar `triggers.sql` y aplicar el SQL incremental siguiente. Para la base anterior: instalar las funciones nuevas y aplicar el mismo cambio. Desde la raíz del repositorio, con los contenedores de desarrollo:

```sh
docker exec -i flywise_postgres psql -U dev_user -d flywise_db -v ON_ERROR_STOP=1 < backend/prisma/functions.sql
docker exec -i flywise_postgres psql -U dev_user -d flywise_db -v ON_ERROR_STOP=1 < backend/prisma/changes/20261024_catalog_v1.sql
docker exec -i flywise_postgres psql -U dev_user -d flywise_db -v ON_ERROR_STOP=1 < backend/prisma/triggers.sql
```

Después, desde backend con `DATABASE_URL` exportada, ejecutar `npx prisma db init --db "$DATABASE_URL"` para comprobar compatibilidad y firmar el contrato, seguido de `npx prisma db verify --db "$DATABASE_URL"`. `db init` solo aplica operaciones aditivas compatibles. La comprobación de Prisma de esta RC no modela la semántica de nulos del índice único: aplicar el SQL también en bases nuevas; la prueba de reimportación verifica esa semántica en PostgreSQL.

El SQL conserva datos de catálogo/auditoría, retira los dos valores derivados y elimina las tres claves de presentación/programación retiradas de configuraciones y snapshots anteriores. Si hay ofertas duplicadas previas, la restricción nueva falla y revierte el cambio: no borra datos para conseguir que pase.

Verificaciones: `npm run build` y `npm test` en ambos proyectos; `npm run test:e2e -- --runInBand` en backend. Las integraciones verifican datos reales con streams, idempotencia, enriquecimiento de operador, auditoría, aislamiento de snapshots, fallos de cola y las restricciones SQL. No se incorpora un comando `db:upgrade` ni un script propio para aplicar cambios.
