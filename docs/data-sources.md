# Fuentes de datos para FlyWise

Revisión de documentación pública: 24 de octubre de 2026. Las fuentes alternativas de este informe no están integradas automáticamente. La v1 ejecuta catálogos OpenFlights y muestra métricas operativas desconocidas como `NULL` / «Sin datos».

## Recomendación para completar OTP

Empezar por **BTS Reporting Carrier On-Time Performance**, con un mes y un conjunto pequeño de rutas domésticas de Estados Unidos. Después incorporar cobertura argentina/internacional con una fuente que publique llegada programada y llegada real, además de cancelaciones y desvíos. No extrapolar puntualidad de Estados Unidos a otras rutas ni a aerolíneas sin muestra.

| Fuente | Qué permite obtener | Uso recomendado y límites |
| --- | --- | --- |
| [BTS: diccionario de Reporting Carrier On-Time Performance](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ) y [descargas oficiales](https://www.bts.gov/airline-data-downloads) | Operaciones reportadas, fecha, operador, extremos, horarios y demora de llegada, cancelaciones y desvíos. | Primera fuente de OTP real. Cobertura de los operadores/vuelos sujetos a reporte estadounidense; no es una base mundial. Descarga pública mensual, con rezago. |
| [ANAC: recurso 2026 y diccionario](https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac/archivo/7b6d0103-0a69-4c67-aed9-33cb58ae12f5) | Movimientos, fecha, hora UTC, aeropuertos, aerolínea y pasajeros. | Útil para una red argentina observada. El diccionario consultado no proporciona llegada programada y real emparejadas: no basta para OTP. Un vuelo de cabotaje genera aterrizaje y despegue; no contarlos como dos vuelos. El origen/destino puede usar códigos nacionales FAA o ICAO, que requieren correspondencias. |
| [EUROCONTROL Aviation Intelligence](https://www.eurocontrol.int/prudata/) | Indicadores de puntualidad y datos europeos de operación. | Sirve para contrastar resultados agregados y estudiar acceso de investigación. Un porcentaje aeroportuario no puede convertirse en OTP por tramo y aerolínea. Verificar granularidad, acceso y metodología del dataset elegido. |
| [Cirium Historical Flight Status](https://developer.cirium.com/apis/cirium-sky-api/historical-flight-status) | Horarios programados, estimados y reales; demoras e historia de vuelos. | Candidato comercial para ampliar cobertura internacional. Evaluar una muestra de EZE/AEP y los operadores requeridos antes de contratar; confirmar autorización para persistir y publicar agregados. |
| [OAG API Catalogue](https://developers.oag.com/apis) | Horarios, estado de vuelos, conexiones e indicadores operativos. | Alternativa comercial para horarios y estado. Elegir el producto con historia y eventos reales: un horario publicado solo no prueba puntualidad. |
| [FlightAware AeroAPI](https://www.flightaware.com/commercial/aeroapi/) e [historia por aeropuerto/operador](https://blog.flightaware.com/new-flightaware-aeroapi-release-more-ways-to-access-historical-data) | Estado y eventos operativos; consultas históricas según producto contratado. | Evaluar por cobertura de las rutas seleccionadas, presencia de horarios de puerta y permisos de almacenamiento. No equiparar automáticamente aterrizaje con llegada a puerta. |
| [AeroDataBox: documentación](https://doc.aerodatabox.com/) e [historia de un vuelo](https://aerodatabox.com/flight-history/) | Estado, historia y horarios de movimientos según endpoint y cobertura. | Candidato para una prueba pequeña. Revisar profundidad histórica, campos efectivamente completos, límites y términos vigentes; no asumir equivalencia con una descarga masiva mundial. |

Los proveedores comerciales requieren evaluar planes, cobertura y licencia. No se fijan precios: cambian y no se solicitó una cotización. La ficha del [dataset de ANAC](https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac) declara CC BY 4.0.

### Cómo conectar BTS con el modelo existente

1. Seleccionar **Reporting Carrier / operador**, sin mezclarlo con el transportista comercial de un codeshare. Obtener fecha, número de vuelo, identificadores de extremos/operador, `ArrDelay`, `Cancelled` y `Diverted` del [diccionario oficial](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ).
2. Resolver identificadores BTS mediante sus tablas de referencia y correspondencias inequívocas. Un ID BTS no es un ID OpenFlights. Los códigos pueden cambiar o reutilizarse; los identificadores históricos importan.
3. Normalizar a `Flight`, con identidad de operación estable para reintentos. Mantener fecha local de salida, anticipos como demora negativa y ausencia de demora como desconocida, nunca cero.
4. Aplicar la definición actual de FlyWise: puntual si `ARRIVED` y demora **<= 15 minutos**. BTS considera demorado un arribo **>= 15 minutos**: su frontera difiere. No calcular el indicador del proyecto como `1 - ArrDel15`; usar `ArrDelay` y documentar la diferencia. Véase la [directiva técnica oficial](https://www.bts.gov/sites/bts.dot.gov/files/2024-08/TechnicalDirectiveNo25.pdf).
5. Recomponer `RouteMetric` mensualmente por `(originId, destinationId, airlineId, period)`, sumando contadores y demoras. No promediar porcentajes entre meses ni duplicar una operación publicada por dos fuentes.
6. Publicar junto a cada resultado su período, cobertura, tamaño de muestra y fuente. La definición actual de FlyWise usa operados = total menos cancelados; los desviados no son arribos puntuales al destino original. Una comparación con estadísticas externas debe reconciliar también ese denominador.

El importador BTS y la agregación operativa siguen fuera de esta entrega. El constructor de catálogos CSV no sustituye ese importador: requiere normalización de operaciones, descompresión del archivo publicado y correspondencias de identidades.

## Alternativas para los catálogos

| Catálogo | Fuente | Ventaja y límite |
| --- | --- | --- |
| Aeropuertos, países, regiones y pistas | [OurAirports: descargas](https://ourairports.com/data/) y [CSV actualizados diariamente](https://davidmegginson.github.io/ourairports-data/) | Catálogo geográfico amplio; datos publicados como dominio público. No incluye una red comercial de rutas ni OTP. Distinguir aeropuertos, helipuertos e instalaciones cerradas al presentar el mapa. |
| Aeropuertos, aerolíneas y rutas históricas | [OpenFlights: formatos y descarga](https://openflights.org/data.php) | Adecuado para la demostración actual y relaciones por ID. Rutas sin actualización desde junio de 2014: no presentarlas como oferta vigente. Su documentación explica `\N`, códigos ausentes y direccionalidad. La licencia publicada es ODbL/DbCL, con detalles según procedencia. |
| Aeropuertos y aerolíneas, códigos oficiales IATA | [IATA Code Search](https://www.iata.org/codes/) | Fuente oficial de consulta de códigos. La búsqueda gratuita tiene límites; la base completa es un producto separado. No es una autorización para extraer masivamente todo el buscador. |
| Aeropuertos, operadores y aeronaves, códigos ICAO | [ICAO API Data Service](https://www.icao.int/api-data-service) | Referencias oficiales DOC7910, DOC8585 y DOC8643. Evaluar descarga/API y condiciones de acceso; no asumir un catálogo completo gratuito. |
| Tramos efectivamente operados con cobertura estadounidense | [BTS T-100 y descargas](https://www.bts.gov/airline-data-downloads) | Permite construir conectividad observada y volumen por período. No sustituye horarios futuros ni resultados de puntualidad por vuelo. |
| Tramos observados de Argentina | [ANAC: movimientos](https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac) | Alternativa pública para reconstruir conectividad argentina por período. Resolver códigos nacionales y evitar duplicar aterrizajes/despegues del mismo servicio. |
| Oferta comercial actual y futura | [OAG Schedules](https://knowledge.oag.com/docs/using-the-api) | Horarios y vigencia de servicios; candidato para reemplazar la red histórica de OpenFlights. Acceso comercial y licencia del producto. |
| Conectividad inferida de trayectorias | [OpenSky: límites de sus datos](https://opensky-network.org/about/faq) | Útil para investigación de vuelos observados. No publica horarios comerciales, cancelaciones o demoras: no calcular OTP a partir de trayectorias solamente. Acceso y términos dependen del uso. |

### Orden propuesto de incorporación

- **Próxima entrega de métricas:** BTS en una cobertura acotada, con pruebas sobre un CSV real y resultados trazables.
- **Mejor catálogo aeroportuario:** reconciliar OurAirports con OpenFlights mediante códigos inequívocos; conservar las dos identidades de origen. **No mapear `OurAirports.id` a `openflightsId`**, porque son espacios de identificadores diferentes.
- **Red argentina observada:** ANAC, con período de observación explícito y correspondencias de códigos nacionales.
- **Red internacional vigente y OTP fuera de BTS:** muestra contractual de Cirium/OAG/FlightAware/AeroDataBox; confirmar campos reales, cobertura argentina, historia, cancelaciones y derechos de redistribución.

No hay una fuente pública verificada en esta revisión que reemplace simultáneamente todos los catálogos y proporcione OTP mundial completo. La v1 conserva lo desconocido como desconocido.
