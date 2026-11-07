# Verificación de países y etiquetas del mapa

Fecha: 2026-11-07. Rama: `feature/traduccion-mapa-catalogo`.
Base de revisión: `6a6abda4b7d70ec6fb1dba5cfa0d4c4fdd0c2bb2`.
Implementación inicial: `80555c9`.

## Resultado de las verificaciones automatizadas

| Verificación | Resultado |
| --- | --- |
| Backend: `npm run build` | Correcto |
| Backend: ESLint completo, sin auto-fix | 0 errores y 0 warnings |
| Backend: `npm test -- --runInBand` | 34 suites, 209 pruebas aprobadas |
| Frontend: `npm run build` | Correcto |
| Frontend: `npm test` | 32 archivos, 208 pruebas aprobadas |
| PostgreSQL + HTTP: localización, rutas globales y validación de rutas | 3 suites, 3 pruebas aprobadas |
| Parser real de MapLibre sobre ambos estilos, ES/EN | 106 expresiones válidas |

Se verificaron `flywise_postgres` y `flywise_redis` activos. Las pruebas de integración crean fixtures dentro de transacciones que se revierten; no se ejecutaron migraciones ni importaciones de datos.

`nuxi typecheck` no se pudo completar: la combinación instalada de TypeScript 7 y vue-tsc falla al resolver `typescript/lib/tsc` (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Se utilizó la compilación de Nuxt, alternativa permitida por AGENTS.md. No se cambiaron dependencias para esta tarea. Prisma y el empaquetador mantienen sus avisos de contrato/chunks; sus compilaciones finalizan con código 0.

## Evidencia del ciclo TDD

- Cabecera: falla al no existir el selector; después permite elegir English y conserva la cookie. Se reforzó la prueba limpiando todo el estado de Nuxt antes de remontar, para verificar restauración desde cookie.
- Filtros: falla con nombres originales; después muestra Alemania/Reino Unido, mantiene IDs y conserva nombres originales. Las opciones incluyen nombre original y ambos idiomas para búsqueda local.
- Contrato HTTP real: falla al faltar `codigoIsoPais`; después lo devuelve en catálogo, búsqueda, proximidad, consulta por código y extremos de rutas, incluidos valores nulos.
- Tarjetas/tooltips: falla al mostrar United Kingdom en español; después alterna con Reino Unido sin cambiar London ni el catálogo cargado.
- Mapa: falla al no localizar estilos; después el parser y evaluador real de MapLibre comprueban texto español/inglés, respaldo ante traducción vacía, formato y zoom. Otra iteración cubre cambios durante la carga, aplicando la última preferencia al quedar el mapa disponible.

## Evidencia del proveedor cartográfico

Se inspeccionaron metadatos y teselas públicas, no solo los nombres de campos del estilo:

- Tema claro: CARTO v1, tesela `2/1/1`, colección `place`. Se observaron `name:es`, `name:en` y `name_en`; por ejemplo London/Londres y Paris/París.
- Tema oscuro: el estilo remoto actual usa CARTO v2, tesela `2/1/1`, colección `places`. Se observaron `name:es` y `name:en`; por ejemplo Spain/España y France/Francia.
- La regla acepta ambos esquemas, descarta traducciones vacías, conserva el nombre original como respaldo y mantiene expresiones de zoom y formato. Las etiquetas numéricas se conservan.

Esta muestra no prueba cobertura mundial ni disponibilidad futura del proveedor. No se midieron 60 FPS en hardware físico.

## Standards

Revisión independiente con contexto fresco sobre `git diff 6a6abda...HEAD`: 0 hallazgos accionables. Se comprobaron aislamiento SSR con useState, inicialización WebGL en cliente, limpieza del watcher, conservación de datos canónicos y ausencia de abstracciones innecesarias.

## Spec

Revisión independiente con contexto fresco: 0 defectos funcionales confirmados y 0 ampliaciones de alcance. Se señaló que remontar conservando useState no demostraba restauración desde cookie; la prueba se reforzó vaciando el estado antes de remontar y pasó. La revisión de código no sustituye la comprobación visual y de hidratación en navegador.

## QA en navegador

Subagente con contexto fresco, Chromium real, sin instalar dependencias ni modificar la implementación:

- Español inicial y cambio a English; English se conserva después de recargar.
- Una cookie inválida vuelve a español. El selector es accesible por su nombre y se opera con teclado (Enter → End → Enter).
- En anchos 320 y 390 px, el selector queda visible y no hay desbordamiento horizontal.
- El autocomplete real de London muestra Reino Unido en español y United Kingdom en inglés, conservando London y los nombres de aeropuertos originales.
- No se observaron errores de hidratación ni warnings de aplicación en esos flujos.
- El explorador responde por SSR con HTTP 200 y el selector presente, sin errores de window o HTMLCanvasElement.

Para verificar filtros sin depender de la GPU se sustituyó únicamente FlightMap.client.vue por un div durante una ejecución separada del navegador. Los controles y el backend fueron reales; este aislamiento no valida el render cartográfico:

- Reino Unido y United Kingdom encuentran el mismo país en ambos idiomas; Germany y Alemania hacen lo propio.
- Después de aplicar el país, cambiar a English y reabrir el modal, se conserva la selección y el modo domestic.
- Ambas aplicaciones del filtro enviaron el mismo paisOrigenId, mode=domestic y limit=50. No se envían los nombres traducidos como identidad.
- La ejecución de filtros terminó sin errores de consola.

**Límite de la primera revisión (superado en la verificación posterior de producción):** no se pudo completar de forma fiable la revisión visual de etiquetas, tooltips sobre el mapa ni cambios de tema con render real. SwiftShader inicializó luma.gl, pero demoró minutos entre interacciones. Sin WebGL se observaron errores resize/destroy en el manejo de inicialización ya presente en la base; no se demostró una regresión de localización. Los tests del ciclo de estilo, el parser real y las teselas inspeccionadas verifican la lógica, pero no sustituyen la comprobación visual en GPU funcional.

No se atribuye a esta QA una cobertura gráfica completa ni una medición de FPS.

## Alcance conservado

Las ciudades y nombres de aeropuertos del catálogo, nombres comerciales de aerolíneas y textos generales no se traducen. Los topónimos del mapa base sí pueden cambiar según sus teselas. El panel administrativo conserva los valores originales editables. No se incorporó Nuxt I18n, una API de traducción ni columnas de traducciones.

Las eliminaciones externas de `.agents/rules/backend.md` y `.agents/rules/frontend.md` se dejaron fuera de los commits de esta funcionalidad. No se hizo push ni merge.


## Verificación posterior de la app levantada y toggle nativo

GATE: OFF (no build active). Se trata de un cambio puntual de control en la app existente, no un rediseño de página. El checker de layout de la skill no pudo procesar la página (Cannot read properties of undefined, reading map); no se modificó el kit ni el resto de la página para cambiar ese resultado. Los scripts shoot de la skill generaron capturas reales a 390 y 320 px, revisadas visualmente.

Se levantó el build de producción en 127.0.0.1:3002 además del desarrollo en 127.0.0.1:3000 y backend en 3001. En producción fue posible repetir el flujo con Chromium y SwiftShader sin aislar FlightMap ni ninguna otra parte de la app, superando la limitación de la primera revisión:

- Mapa y arcos reales renderizados; temas claro y oscuro operativos.
- Etiquetas claras ES/EN visibles: AMÉRICA DEL NORTE / NORTH AMERICA y ÁFRICA / AFRICA.
- Etiquetas oscuras ES/EN visibles tras filtrar Reino Unido: IRLANDA / IRELAND, DINAMARCA / DENMARK y PAÍSES BAJOS / NETHERLANDS.
- Búsqueda bilingüe, filtros conservados y mismo ID al aplicar antes/después de alternar idioma.
- Preferencia conservada al recargar; ejecución sin errores de consola.
- Tooltip real en español comprobado sobre Inverness. La comprobación de hover en inglés no obtuvo un tooltip visible después de cerrar el menú del selector anterior; no se considera demostración de un defecto. La actualización ES/EN del contenido sigue cubierta por el test de tarjetas/tooltips.

Después, a pedido del usuario, se reemplazó el select por UTabs nativo de Nuxt UI (content false, size sm), sin label visible ni indicador o estilos propios. Se actualizó la prueba de cambio de idioma y restauración desde cookie para el control nativo. Se verificaron nuevamente 208 pruebas frontend, 209 backend y las compilaciones de ambos proyectos. Las tres pruebas HTTP/PostgreSQL también pasaron al repetir la prueba de la aplicación. No se añadieron dependencias.

Las capturas del control compacto muestran la cabecera sin desbordamiento en móvil. El idioma y los datos canónicos se conservan. No se midieron FPS ni se garantiza cobertura mundial de traducciones de las teselas.
