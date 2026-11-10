# Verificación del ticket 07 — OTP en el mapa

En **Explorar → Filtrar puntualidad**, se elige un mes observado y, opcionalmente, una aerolínea. La selección inicial usa el último mes BTS completo publicado. Si aún no hay uno, se puede elegir un mes disponible. El catálogo conserva sus conexiones históricas y la vista global dibuja un arco por par. Al abrir el detalle se pueden consultar por separado los sentidos presentes en el catálogo.

`GET /metricas/mapa/opciones` devuelve los períodos y las aerolíneas disponibles. `POST /metricas/mapa` consulta hasta 100 pares dirigidos y agrega los contadores de sus operaciones por mes y aerolínea. El color responde al OTP-15 del sentido dibujado. Cero es rojo, una métrica ausente es gris, y las ofertas con escalas no toman prestada la métrica de un tramo directo.

El detalle muestra período, operador, operaciones que entran en la muestra, fuentes y último cálculo. Durante un recálculo conserva el último valor publicado e indica que la actualización está pendiente. La opción de actualizar también reconcilia un mes o una aerolínea que dejó de estar disponible.

## Regresiones y revisión

- La prueba HTTP contra PostgreSQL comprueba la agregación de contadores, el filtro por operador, ida y vuelta independientes, el último mes BTS completo y el límite de pares. Un array anidado reproducía HTTP 500 y ahora devuelve HTTP 400. Los datos de prueba se revierten.
- Las pruebas de pantalla y de capas comprueban los colores, las respuestas de consultas anteriores, el rechazo tardío sin notificación espuria, la retirada de opciones y el detalle de muestra y procedencia.
- La segunda revisión independiente aprobó las correcciones de validación HTTP, notificaciones obsoletas y filtros retirados.

## Integración local

- La composición con EUROCONTROL pasó la compilación de ambos proyectos, 209 pruebas de backend, 223 de frontend y 8 E2E en 7 suites con PostgreSQL/PostGIS y Redis. El allowlist de Vite para el junction de MapLibre se usó en un archivo local ignorado.
- La revisión final confirmó que la consulta previa de métricas conserva su comportamiento y que la consulta del mapa aplica el filtro de pares dirigidos. Ambos parámetros SQL se pasan al cliente tipado.
- En Edge, a 1440, 768 y 390 px, se verificaron Indicadores y el mapa en la misma compilación. El mapa dibujó rutas del catálogo real y el filtro abrió con un clic. Las respuestas de métricas se controlaron desde el navegador para comprobar el mes inicial, el cambio de filtros y los pares enviados sin publicar coberturas de prueba. La cuenta temporal se retiró y se verificó su ausencia.
- El objetivo de 60 FPS queda pendiente de medir en hardware.
