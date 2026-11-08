# Mapa de vuelos

`useFlightMap` es la interface compartida por la vista, los controles, el buscador y
los atajos. Posee una sola instancia de MapLibre y Deck.gl. Invocar el composable
no instala suscripciones: `initMap` las crea y `destroyMap` las detiene.

## Responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `components/FlightMap.client.vue` | Contenedor DOM, montaje, dimensiones y limpieza de sus RAF. |
| `composables/useFlightMap.ts` | Estado compartido, comandos de cámara y sincronización de selección, tema y perfil. |
| `utils/maplibreRuntime.ts` | Worker empaquetado por Vite, creación de MapLibre y aplicación de capacidades gráficas. |
| `utils/mapUtils.ts` | Estilos del mapa base, cámara inicial y colores OTP. |
| `utils/flightOverlay.ts` | Overlay de Deck.gl, resolución e interacción con rutas y aeropuertos. |
| `utils/mapLayers.ts` | Construcción de las capas de rutas, aeropuertos y etiquetas. |
| `composables/useMapPerformance.ts` | Detección de hardware y viewport; observación cancelable del perfil. |

Una selección conjunta actualiza las capas y encuadra la cámara una sola vez por
turno reactivo. Tema y perfil actualizan el render sin reencuadrar. El zoom solo
regenera etiquetas cuando cruza el umbral de detalle; no reconstruye las capas en
cada frame. Los controles consumen el rumbo compartido.

MapLibre y Deck.gl usan canvas separados. Ambos deben aplicar el mismo límite de
DPR. En el perfil móvil se desactiva el picking automático; un clic o toque hace
una consulta explícita y conserva la selección. La opción `_pickable` de Deck.gl
es experimental: verificar ese comportamiento al actualizar la dependencia.

La caché de tiles usa el dimensionamiento automático de MapLibre según el
viewport. El mapa base sigue usando CARTO: alojar el JSON de estilo localmente
no elimina sus peticiones de tiles, fuentes y sprites.

MapLibre 6 requiere configurar su worker con `?worker&url` en Vite. Sin ello,
el canvas y los overlays pueden aparecer aunque la geografía nunca cargue.
Referencia: [instalación de MapLibre](https://maplibre.org/maplibre-gl-js/docs/).

## Verificación de rendimiento

El objetivo es un presupuesto de aproximadamente 16,7 ms por frame a 60 Hz.
Los tests de Vitest verifican decisiones y sincronización; no miden FPS de GPU.

Medir en un build de producción, con geografía visible y sin herramientas de
desarrollo abiertas. Repetir vista global, selección de hub, selección de ruta,
zoom y paneo, con caché fría y caliente. Registrar:

- Navegador, CPU/GPU, viewport, DPR nativo y DPR de ambos canvas.
- Cantidad de aeropuertos y rutas realmente dibujados.
- Cadencia media y percentil 95 de los intervalos entre frames; frames superiores a 25 ms.
- Tiempo de carga y errores de recursos o del worker.

El catálogo actual contiene 30 aeropuertos y 48 rutas mock. Una medición con ese
catálogo no prueba rendimiento con datos globales. Emular un viewport móvil en
una GPU de escritorio tampoco reemplaza medir un teléfono real. Conservar
selección, rutas y métricas al reducir resolución, etiquetas o decoración.
