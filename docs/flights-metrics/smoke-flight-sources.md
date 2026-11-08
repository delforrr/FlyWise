# Smoke test y guía de fuentes de vuelos

Fecha: **8 de noviembre de 2026**, aproximadamente 00:27–00:31 de Argentina (UTC−3). Complementa [data-sources.md](data-sources.md). Los resultados son una observación puntual, no una garantía de disponibilidad ni de cobertura.

## Decisión recomendada

1. **BTS Reporting Carrier** para el primer informe de puntualidad: se descargó un mes real y se verificaron campos suficientes para normalizar operaciones. Esfuerzo medio; alcance estadounidense.
2. **ANAC** para informes argentinos de movimientos, conectividad y pasajeros: datos accesibles y legibles, pero sin pares de horarios programados/reales para OTP. Esfuerzo medio y modelo de actividad separado.
3. **Cirium o FlightAware** para una muestra histórica argentina; sumar **OAG** a la comparación si también necesitamos oferta vigente. No elegir proveedor comercial sin medir completitud de llegada a puerta y confirmar derechos del producto contratado.
4. **OurAirports** para mejorar el catálogo geográfico, usando el espejo oficial mientras el acceso principal falle. EUROCONTROL sirve para comparación agregada; OpenSky para observación de aeronaves. Ninguno sustituye un historial comercial mundial de puntualidad.

La prioridad y el esfuerzo son una evaluación del encaje con este repositorio, no un benchmark entre proveedores ni una estimación contractual de plazos.

## Qué se probó y con qué evidencia

Se hicieron GET públicos sin credenciales, con TLS validado y timeout de 15–20 segundos para las consultas pequeñas. La primera tanda retuvo como máximo 8 KiB por respuesta y canceló el resto. Se descargó además el ZIP BTS completo a disco temporal y se leyeron sólo las primeras 1.000 filas del CSV mediante stream; ANAC y OurAirports también se muestrearon con parser CSV en stream. El ZIP temporal fue eliminado. No hubo ingesta en la base, creación de cuentas ni solicitudes autenticadas facturables.

Evidencia conservada:

- [Respuestas HTTP](smoke-flight-sources-http.json): URLs exactas, estados, errores y extractos de respuesta. Los tiempos corresponden a una única petición; no expresan SLA.
- [Muestra BTS](smoke-flight-sources-bts.json): SHA-256 del ZIP, tamaños, columnas, contadores y tres operaciones de ejemplo.
- [Muestras ANAC y OurAirports](smoke-flight-sources-csv.json): cabeceras efectivas y resultados de 1.000 filas por fuente.
- [Investigación comercial](research-flight-commercial.md): capacidades, acceso, condiciones documentadas y enlaces oficiales.

**Un HTTP 200 de una página no demuestra acceso a datos; una firma ZIP no demuestra que el workbook sea válido.** Las primeras 1.000 filas tampoco son una muestra estadística representativa. Las siguientes filas separan esos niveles de verificación.

| Fuente / producto | Prueba observada | Resultado y utilidad | Encaje en nuestro backend |
| --- | --- | --- | --- |
| BTS Reporting Carrier OTP | ZIP agosto 2026: `200`, descarga completa y lectura de 1.000 operaciones | **Aprobado en descarga y muestra.** Puntualidad, demoras, cancelaciones y desvíos reportados | **Alta utilidad / esfuerzo medio.** Nuevo importador ZIP + operaciones; reutilizar BullMQ, auditoría y tablas operativas |
| ANAC movimientos 2026 | CSV `200`; 1.000 filas parseadas con `;` | **Aprobado en descarga y muestra.** Actividad y conectividad argentina; insuficiente para OTP | **Alta para actividad / esfuerzo medio.** Normalizar códigos y movimientos; no cargar como arribos con demora cero |
| EUROCONTROL puntualidad | Dos XLSX `200` y firma `PK`; portal y definición legibles | **Parcial.** Descarga alcanzable; hojas y celdas no inspeccionadas. Comparación de red/Estado/aeropuerto | **Media / esfuerzo bajo para consulta externa, medio para importar.** Agregados separados de `MetricaRuta` |
| Cirium Sky / Historical Flight Status | Catálogo Sky `/v1/airlines`: `401`, `missing_authentication`; documentación histórica revisada | **Pendiente autenticado.** No se ejecutó una consulta histórica válida | **Potencial alto / esfuerzo medio–alto.** Adaptador del producto contratado, ventanas, identidad y cobertura |
| OAG Flight Info | `flight-instances` sin `Subscription-Key`: `401` JSON | **Pendiente autenticado.** Barrera de suscripción observada, datos no comprobados | **Potencial alto / esfuerzo medio–alto.** Paginación y Status/historia; Schedules solo aporta programación |
| FlightAware AeroAPI | Vuelos de SAEZ e historia de arribos: `401`, `INVALID_API_KEY` | **Pendiente autenticado.** Sin operaciones recibidas | **Potencial alto / esfuerzo medio.** Páginas con límite, `fa_flight_id`, comprobar `scheduled_in`/`actual_in` |
| AeroDataBox directo | Consulta AR1300: `403` HTML de Cloudflare; OpenAPI revisado | **Bloqueado en este acceso.** No prueba rechazo de autenticación de la API ni ausencia de cobertura | **Media para OTP / esfuerzo medio.** Validar evento real frente a estimado y puerta frente a pista |
| OurAirports | Dominio principal: `CERT_HAS_EXPIRED`; espejo oficial: `200`, 1.000 filas parseadas | **Aprobado por espejo.** Geografía y códigos, sin métricas de vuelo | **Alta para catálogo / esfuerzo bajo–medio.** Mapeo de columnas y reconciliación de identidades |
| OpenFlights | Aeropuertos, aerolíneas y rutas de GitHub: `200`, prefijos legibles | **Acceso aprobado; importación no repetida.** Compatible con el catálogo actual, rutas históricas | **Alta implementabilidad actual, baja utilidad para métricas operativas** |
| IATA Code Search | Página `200`; documentación oficial legible | **Sólo documentación/interfaz.** No se ejecutó búsqueda interactiva ni extracción de base | **Baja prioridad para informes.** Validación puntual; catálogo completo por producto autorizado |
| ICAO API Data Service | Página `200`; registro y prueba anunciados | **Sólo documentación.** No hubo registro ni llamada de datos con clave | **Media para referencias, baja directa para OTP.** Evaluar producto y correspondencias oficiales |
| BTS T-100 Segment | Formulario `200` HTML; diccionario oficial verificado | **Parcial.** No se generó exportación ni se parsearon registros T-100 | **Alta para volumen observado / esfuerzo medio.** Agregados por período; no fabricar vuelos individuales |
| OpenSky | `states/all` en rectángulo de Buenos Aires: `200` JSON con estados de aeronaves | **Aprobado en consulta anónima de posiciones.** Historia y rutas no probadas | **Baja para OTP / media para investigación.** No proporciona programación ni cancelaciones comerciales |

## Guía por fuente pública

### BTS Reporting Carrier: primera implementación de OTP

El [diccionario oficial](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FGJ) distingue operador reportante, identidades DOT, aeropuertos históricos, demora con signo y cancelación/desvío. La [descarga probada de agosto de 2026](https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_2026_8.zip) tiene **32.030.583 bytes comprimidos** y un CSV de **275.779.587 bytes**. En las primeras 1.000 operaciones: 12 canceladas, 5 desviadas, 17 demoras ausentes, 596 negativas y 8 de exactamente 15 minutos. No son tasas del mes completo.

Usar `FlightDate`, `Flight_Number_Reporting_Airline`, `DOT_ID_Reporting_Airline`, `OriginAirportID`, `DestAirportID`, `CRSDepTime`, `ArrDelay`, `Cancelled` y `Diverted`. Resolver identidades con correspondencias BTS; no confundirlas con OpenFlights. Para reintentos, definir una identidad estable que incluya salida programada además de fecha, operador, número y extremos; comprobar colisiones antes de declararla única.

`ArrDelay` preserva anticipos; `ArrDelayMinutes` los lleva a cero. `ArrDel15` marca demora desde 15 minutos. La regla documentada de FlyWise usa `<= 15`: las ocho filas de frontera muestran por qué no basta invertir `ArrDel15`. Dar precedencia explícita a cancelado/desviado antes de interpretar la demora; no tratar desvíos que llegaron posteriormente como arribos normales al destino original.

La implementación mínima debe descargar/descomprimir a disco o mediante streams Node, parsear con `csv-parser`, persistir lotes de 1.000–5.000 y registrar checksum, período, filas y descartes. Empezar con un mes y pocas rutas; probar idempotencia, frontera de 15 minutos, anticipos, cancelaciones/desvíos y referencias no resueltas.

### ANAC: actividad argentina, sin OTP

La [ficha y su diccionario](https://datos.transporte.gob.ar/dataset/aterrizajes-y-despegues-procesados-por-la-administracion-nacional-de-aviacion-civil-anac/archivo/7b6d0103-0a69-4c67-aed9-33cb58ae12f5) enlazan hoy un recurso cuyo nombre contiene septiembre de 2026, aunque comienza en enero. **Resolver el enlace desde la ficha en cada actualización; no fijar para siempre ese nombre.**

El CSV observado tiene 13 columnas, separador `;`, `Fecha UTC` como `DD/MM/YYYY` y hora como `0:01`. Esto difiere de la declaración ISO de la ficha. La muestra contiene 515 despegues y 485 aterrizajes; no implica 1.000 vuelos distintos. Aporta también matrícula, operador por nombre y calidad del dato, pero no número comercial ni horarios programados/reales emparejados.

Para informes de cabotaje, seleccionar despegues para contar tramos dirigidos sin duplicar su aterrizaje. Para movimientos por aeropuerto, conservar ambos tipos. Un aterrizaje invierte el papel de `Aeropuerto` y `Origen / Destino` respecto de un despegue. No inferir correspondencias FAA/IATA por similitud: el código nacional `AER` requiere su tabla. `Pasajeros` y `PAX` tienen usos distintos según la ficha; no sumarlos como columnas equivalentes. Los últimos dos meses pueden revisarse. La licencia declarada es [CC BY 4.0](https://datos.transporte.gob.ar/dataset/21038a1a-c3c7-4494-b76a-3a2a8fbb83b5).

Requiere hechos de actividad propios o un agregado con fuente/período/calidad: no cabe directamente en `Vuelo`, que exige número y demora conocida para `ARRIVED`.

### EUROCONTROL: contraste agregado

El portal enlaza [puntualidad de red](https://www.eurocontrol.int/Economics/Download/Network_Punctuality.xlsx) y [puntualidad de Estados/aeropuertos](https://www.eurocontrol.int/Economics/Download/Stakeholder_Punctuality.xlsx). Se verificaron respuesta, tipo y firma; queda pendiente inspeccionar hojas, columnas, cobertura y permisos de reutilización antes de crear un importador.

Su [definición de OTP15](https://ansperformance.eu/definition/punctuality/) incluye hasta **15:59** tras la hora programada. No comparar directamente ese agregado con el cálculo FlyWise ni repartir porcentajes aeroportuarios entre rutas/aerolíneas. Útil como contexto europeo en informes; no como operaciones para nuestra tupla analítica.

### OurAirports y OpenFlights: referencias

El [espejo oficial de OurAirports](https://davidmegginson.github.io/ourairports-data/) publica CSV diarios. La muestra leyó 1.000 filas con coordenadas numéricas, incluidos helipuertos; no se auditó la geografía completa. Mapear `latitude_deg`, `longitude_deg`, `iso_country`, `iata_code` e `icao_code`. No asumir que `ident`, `gps_code` o `local_code` sean siempre ICAO. Conservar `OurAirports.id` en su propio espacio de identidad, nunca en `idOpenflights`; filtrar tipo/servicio según el producto.

Los archivos OpenFlights probados son los que ya admite el ETL. Su [documentación](https://openflights.org/data.php) advierte que las rutas dejaron de actualizarse en junio de 2014 y que el campo de aerolínea activa no es fiable. Aportan demostración y relaciones de catálogo; no programación vigente ni OTP. Revisar atribución y condiciones ODbL/DbCL al publicar derivados.

### IATA, ICAO, T-100 y OpenSky

- [IATA](https://www.iata.org/codes/) ofrece búsqueda oficial limitada y un producto separado de base completa. Esta prueba sólo verificó la página y las condiciones descritas. No montar ETL sobre scraping del buscador.
- [ICAO](https://www.icao.int/api-data-service) anuncia DOC7910, DOC8585 y DOC8643 y 25 llamadas de prueba tras registro. No se obtuvo clave. Sirve para referencias; no se demostró que el producto resuelva historia operacional de FlyWise.
- [T-100 Segment](https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FMG) documenta salidas programadas/realizadas, plazas, pasajeros y carga por segmento/período. Hace falta probar la exportación del formulario con campos y fechas elegidos. El índice PREZIP accesible no constituye por sí mismo una descarga T-100 válida. No derivar OTP ni cancelaciones individuales de sus agregados.
- La [FAQ de OpenSky](https://opensky-network.org/about/faq) explica que infiere vuelos desde trayectorias y no ofrece horarios, demoras o cancelaciones comerciales. El JSON observado contiene posiciones; el callsign no reemplaza la identidad comercial de una operación. Historia, cuotas y uso comercial requieren revisión del acceso concreto.

## Cambios que necesitaría el backend

La lectura de [contract.prisma](../backend/prisma/contract.prisma), [EtlProcessor](../backend/src/etl/etl.processor.ts), [configuración de conexiones](../backend/src/etl/interfaces/pipeline-configuration.ts) y [http-source.ts](../backend/src/etl/http-source.ts) muestra:

- Existen `Vuelo` y `MetricaRuta`, identidad única `(fuente, idRegistroFuente)` y clave mensual `(origenId, destinoId, aerolineaId, periodo)`. El mapa continúa devolviendo `otp15: null`; no hay importación/agregación operacional activada.
- El enum incluye `otp_metrics`, pero los jobs activos sólo aceptan países, aeropuertos, aerolíneas y rutas. Añadir una opción al formulario no implementa la normalización de vuelos.
- El lector actual admite CSV HTTPS sin parámetros, sin redirecciones y sin compresión HTTP. Por defecto sólo autoriza `raw.githubusercontent.com` y `davidmegginson.github.io`. BTS/ANAC requieren autorización de hosts; ZIP, XLSX y JSON requieren lectores específicos. Las APIs paginadas con query no pasan la validación actual. Mantener la protección SSRF al incorporar adaptadores, sin abrir URLs arbitrarias.
- Se pueden reutilizar BullMQ, lotes, contadores, eventos y referencias de credenciales por entorno. Separar por proveedor el formato de entrada; normalizar una sola vez al contrato operacional. Aplicar backoff a `429`/fallos transitorios, límites de páginas y consumo, y detener errores permanentes de autenticación.
- `Vuelo` sólo permite `ARRIVED`, `CANCELLED`, `DIVERTED`; `ARRIVED` exige demora no nula. Programados, activos, cancelaciones inciertas y arribos incompletos necesitan quedar fuera de esa tabla hasta resolverse, con trazabilidad de descartes/pendientes. No convertir ausentes o estimados en cero.
- El esquema conserva demora, pero no timestamps ni naturaleza del evento puerta/pista. La ingesta comercial debe resolver esa semántica antes de persistir y conservar evidencia mínima permitida por licencia. Si necesitamos recalcular desde eventos originales, hará falta una migración incremental.
- Para el informe inicial, recalcular contadores desde operaciones únicas del período y sustituir el agregado de forma atómica. Reintentos y correcciones no deben sumar dos veces. La unicidad por fuente no evita duplicación entre proveedores: elegir una fuente autoritativa por cobertura o resolver identidad cruzada.

Publicar fuente, período, muestra, cobertura y descartes. Aplicar la definición de [data-sources.md](data-sources.md): operados = total menos cancelados; los desviados no cuentan como puntuales. Para demora media, usar arribos con demora conocida y explicitar ese denominador. Los porcentajes entre períodos se recomponen desde contadores; no se promedian.

## Cómo repetir y completar la evaluación

Para repetir el control HTTP sin descargar cuerpos grandes, desde la raíz del repositorio:

```powershell
@'
import { readFile } from 'node:fs/promises';
const { results } = JSON.parse(await readFile('docs/smoke-flight-sources-http.json', 'utf8'));
for (const { name, url } of results) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const reader = response.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    console.log(name, response.status, response.headers.get('content-type'),
      Buffer.from(value ?? []).subarray(0, 16).toString('hex'));
  } catch (error) { console.log(name, error.message, error.cause?.code); }
}
'@ | node --input-type=module
```

Esto repite conectividad, no las validaciones de contenido. Para BTS: descargar el ZIP de la evidencia a disco temporal, verificar SHA-256, abrir el CSV como stream y leer cabecera + 1.000 filas. En esta sesión se usaron `curl`, `System.IO.Compression.ZipFile` y `StreamReader`; sólo esas líneas acotadas pasaron a `ConvertFrom-Csv`. En ANAC/OurAirports se usó `csv-parser` instalado en backend, con `maxRowBytes: 65536` y corte a 1.000 registros. Las validaciones ejecutadas comprobaron HTTP 200, cantidad de registros y formato de fecha ANAC; no validan toda la descarga anual.

Para cerrar la comparación comercial, usar el mismo día completo de EZE/AEP y un mes de dos rutas (cabotaje e internacional). Definir antes el umbral aceptable de cobertura. Consultar todas las páginas, incluyendo cancelaciones/desvíos, con techo de consumo. Medir operaciones únicas, códigos compartidos duplicados, operador resuelto, pares reales/programados de puerta, sólo pista, sólo estimados, ausentes, páginas, latencia y costo. Confirmar producto, retención, agregados y redistribución antes de persistir/publicar. Ver [detalle por proveedor](research-flight-commercial.md).

## Verificación del repositorio

Sólo se modificaron documentación y evidencias, en `feature/smoke-fuentes-vuelo`. Sin cambios a servicios, dependencias, migraciones o datos persistidos; sin commit, push ni merge.

- Contenedores `flywise_postgres` y `flywise_redis`: activos antes de ejecutar pruebas.
- `frontend/npm test`: **32 archivos, 208 tests aprobados** fuera del sandbox. La primera ejecución restringida falló al acceder a temporales.
- `backend/npm run build`: **falló**, incluso fuera del sandbox, por módulo ausente `@prisma/orm-postgres/config`.
- `backend/npm test`: **26 suites fallaron y 8 pasaron**, 37 tests ejecutados aprobados. Faltan módulos como `@nestjs/swagger`, `@nestjs/jwt` y `@prisma/orm-postgres/runtime`; las suites fallidas no llegaron a ejecutar sus casos.
- `frontend/npm run build`: **aprobado, salida 0** con acceso autorizado. La primera ejecución restringida falló en Nitro por `EPERM` al resolver `vue/index.mjs`; la repetición completó cliente, SSR y Nitro. Quedaron advertencias de tamaño de chunks y dependencias.
- JSON, contadores de las muestras y enlaces locales: verificados; `git diff --check` sin errores y `git status` sólo muestra los seis archivos de documentación/evidencia esperados. **El Quality Gate global no está verde** por los fallos del backend; no se cambió la instalación para resolverlos dentro de una investigación de fuentes.

Queda pendiente el smoke test autenticado de los servicios comerciales, la exportación T-100, la inspección interna de XLSX y una ingesta real con agregación. No se infiere cobertura mundial ni argentina completa a partir de estas pruebas.
