# Proveedores comerciales de métricas: investigación de soporte

Revisión: 8 de noviembre de 2026. Complementa el smoke test general de fuentes de datos. Se consultaron exclusivamente páginas oficiales. **No hubo una respuesta de operaciones autenticada:** no se utilizaron credenciales, se crearon cuentas ni se hicieron consultas facturables. La disponibilidad de documentación no demuestra cobertura de EZE/AEP.

## Resultado verificable de esta revisión

| Servicio | Evidencia consultada | Resultado | Qué falta demostrar |
| --- | --- | --- | --- |
| Cirium | Documentación de Historical Flight Status y autenticación de Sky/FlightStats | Documentación localizada mediante búsqueda oficial; una apertura posterior del sitio devolvió contenido vacío | Payload autenticado, completitud de puerta y licencia de persistencia/agregados |
| OAG | Portal, catálogo, documentación de paginación y producto Status | Documentación pública accesible; catálogo requiere contenido dinámico para mostrar productos | Suscripción habilitada para Status/historia, respuesta real y derechos |
| FlightAware | AeroAPI, portal y respuesta de soporte oficial sobre OOOI | Página comercial accesible; el portal no expuso el esquema por extracción de texto | Payload real e historia del nivel contratado; cobertura de puerta |
| AeroDataBox | OpenAPI directo JSON v1.15.4.0, precios y términos | Especificación pública legible; describe auth, rutas y contratos | Operaciones reales, cobertura argentina y aptitud contractual |

Los intentos iniciales dentro del sandbox fallaron por red. La repetición con acceso de red autorizado obtuvo `401` JSON en Cirium Sky, OAG y FlightAware, y `403` HTML de Cloudflare en AeroDataBox. Ver [evidencia HTTP](smoke-flight-sources-http.json) y [guía principal](smoke-flight-sources.md). Los `401` comprueban la barrera de autenticación; el `403` no permite atribuir el rechazo a una clave ausente. Ninguna respuesta contiene operaciones autenticadas. La prueba Sky consultó el catálogo de aerolíneas, no el endpoint histórico.

## Cirium Historical Flight Status

Publica historia desde el 7 de febrero de 2006, horarios programados/estimados/reales, demoras y estado de cancelación/desvío. Permite consultar por vuelo, aeropuerto, ruta o identificador; las ventanas aeroportuarias son de hasta seis horas. Historical Flight Status está limitado al plan Contract. Estos son atributos documentados, no medidos en una muestra. [Documentación oficial](https://developer.cirium.com/apis/cirium-sky-api/historical-flight-status).

No mezclar familias de autenticación: Sky usa `Authorization: {your_api_token}`; FlightStats Flex documenta `appId` y `appKey` en cabeceras o query. El adaptador debe corresponder al contrato efectivamente habilitado. [Sky](https://developer.cirium.com/apis/cirium-sky-api/airlines), [FlightStats](https://developer.cirium.com/apis/flightstats-apis/get-started).

**Utilidad inferida: alta; esfuerzo: medio/alto.** Es un candidato para informes históricos internacionales por ruta/operador. Consultar una fecha y ventana pequeña antes de ampliar; conservar identidad del proveedor, operador y fecha de operación. Requerir pares programado/real del mismo evento y comprobar campos de puerta en la muestra. No asumir que el contrato permite guardar operaciones o republicar agregados.

## OAG

Flight Info devuelve horarios y estado por instancia; Schedules cubre programación. El ejemplo oficial usa `Subscription-Key`. La amplitud mundial anunciada es del proveedor y no valida por sí sola la calidad argentina. [Portal](https://developers.oag.com/).

Status documenta estados de puerta/pista, cancelados y desviados, eventos programados/estimados/reales y distinción de operador/codeshare. La ventana de seguimiento comienza 48 horas antes y termina 24 horas después; **esto no es la profundidad histórica del contrato**. [Producto Status](https://www.oag.com/flight-status-data).

La API pagina resultados mediante cursores y `paging.next`; procesar cada página antes de pedir la siguiente. El onboarding contempla suscripción de prueba o completa. [Paginación](https://developers.oag.com/guides?api=flight-instances), [Alta](https://knowledge.oag.com/docs/flight-info-api-getting-started).

**Utilidad inferida: alta; esfuerzo: medio/alto.** Interesa especialmente si también queremos reemplazar la red histórica de OpenFlights con oferta vigente. Para OTP hace falta Status e historia habilitados; contratar solo Schedules no resuelve puntualidad. Confirmar profundidad, límites, costo de paginación y persistencia/publicación del producto elegido.

## FlightAware AeroAPI

API REST con historia desde enero de 2011. Incluye endpoints históricos por vuelo, aeropuerto, tramo y operador. La historia está en Standard/Premium, no Personal. La página distingue permisos de derivados personales/académicos, B2C y B2B; cobra por conjuntos de resultados, de 15 registros. Revisar límite del plan y `max_pages` antes de estimar costo de un mes. [Producto y planes](https://www.flightaware.com/commercial/aeroapi/).

Usa `x-apikey`; los ejemplos oficiales incluyen `fa_flight_id`, `scheduled_in`, `actual_in`, `scheduled_on`, `actual_on`, `cancelled` y `diverted`. [Ejemplo en foro del proveedor](https://discussions.flightaware.com/t/create-alert-error-no-event-types-specified-for-channel-id/81515).

El soporte del proveedor confirma que los eventos de puerta pueden faltar permanentemente según aeropuerto/aerolínea. Esperar más no garantiza `actual_in`; no reemplazarlo con estimados en un indicador presentado como observado. [Respuesta del soporte](https://discussions.flightaware.com/t/missing-actual-out-actual-in-when-using-event-code-out-in/91197).

**Utilidad inferida: alta; esfuerzo: medio.** Es una alternativa práctica para una muestra histórica acotada por aeropuerto/operador. Persistir `fa_flight_id` como identidad externa y verificar llegada a puerta frente a aterrizaje. El cuello de botella puede ser cobertura y costo por páginas, no NestJS.

## AeroDataBox

El OpenAPI directo define `X-Api-Key`, consultas por vuelo/rango, `scheduledTime`, `revisedTime`, `runwayTime`, calidad `Basic/Live/Approximate` y estados `Canceled`, `Diverted`, `CanceledUncertain`. **`revisedTime` puede ser real o estimado; también puede representar puerta o pista cuando `runwayTime` falta o coincide.** El schema solo no garantiza una llegada real a puerta. [OpenAPI oficial](https://doc.aerodatabox.com/docs/openapi-direct-v1.json).

Los límites del anuncio de febrero de 2025 no deben usarse como límites actuales universales: la página de planes directos consultada muestra historia de 180/365 días y rangos por petición de 14/30/60 días según plan. Marketplace y contrato pueden variar. [Precios y límites actuales](https://aerodatabox.com/pricing), [Anuncio anterior](https://aerodatabox.com/flight-history/).

Los términos diferencian datos originales y obras derivadas. La retención base de datos originales es de siete días con excepciones por plan; la tabla comercial anuncia retención extendida en algunos planes. Los términos exceptúan a derivados de determinadas restricciones de retención, pero mantienen condiciones de uso y sublicencia. Confirmar que la persistencia de `Flight` y la publicación concreta de `RouteMetric` queden cubiertas; una suscripción no equivale a autorización general de redistribución. [Términos, artículo 5](https://aerodatabox.com/terms), [Planes](https://aerodatabox.com/pricing).

**Utilidad inferida: media para OTP estricto, alta para exploración; esfuerzo: medio.** Puede servir para prototipar consultas y disponibilidad. La ambigüedad temporal exige rechazar de OTP los registros sin evento real inequívoco, además de conservar desconocidos. `CanceledUncertain` no equivale a cancelación confirmada.

## Prueba autenticada mínima pendiente

Para comparar proveedores con la misma muestra: un día completo de EZE y AEP, por operador y dirección, más un mes de dos rutas seleccionadas. Fijar previamente identificadores de operación y fecha local; incluir una ruta de cabotaje y otra internacional. Recorrer toda la paginación sin descartar cancelaciones/desvíos. No interpretar una búsqueda sin registros como cero operaciones.

Medir: operaciones únicas, duplicados por codeshare, porcentaje con llegada programada y real de puerta, registros con solo pista/estimados, cancelaciones confirmadas, desvíos, campos ausentes, páginas, latencia y consumo facturable. Guardar fuente, producto, versión, período y momento de extracción; publicar el tamaño de muestra junto al indicador.

La prueba será aceptable para OTP solo cuando los pares de eventos, el operador y los extremos puedan resolverse sin ambigüedad y la licencia permita el uso previsto. No se propone un umbral de cobertura inventado: acordarlo para la muestra antes de contratar.
