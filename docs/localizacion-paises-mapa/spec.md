# Países y etiquetas del mapa en español e inglés

Fecha: 2026-11-07. Base: `f8fb523ff45c0c70eab34e9ff725361ad88aa534` (develop).
Rama documental: `feature/spec-localizacion-paises-mapa`.
Estado: funcionalidad implementada y revisada. Pruebas y QA de producción con mapa completo aprobados. Ver [evidencia y límites](verificacion.md).
Rama de implementación: `feature/traduccion-mapa-catalogo`.

## Problem Statement

Los nombres importados de países se muestran en inglés en distintas vistas, aunque muchos controles ya están en español. El mapa base también contiene etiquetas en inglés. El usuario necesita poder alternar esos nombres entre español e inglés sin alterar los catálogos, los filtros ni las rutas.

## Solution

Ofrecer un selector accesible Español / English, con español por defecto y preferencia persistida en cookie. Usar esa misma preferencia para nombres de países y etiquetas disponibles del mapa base. Mantener el nombre original cuando no se pueda resolver una traducción. Por ajuste posterior del usuario, el control es UTabs nativo de Nuxt UI, compacto (size sm), con EN / ES y sin label visible. Conserva el nombre accesible que indica su alcance: países y mapa.

## User Stories

1. Como explorador, quiero ver países en español inicialmente para reconocerlos fácilmente.
2. Como explorador, quiero elegir English para consultar esos nombres en inglés.
3. Como usuario que regresa, quiero conservar mi elección después de recargar y navegar.
4. Como usuario de teclado, quiero operar el selector y reconocer su valor actual.
5. Como explorador, quiero buscar Alemania en el selector de países y seleccionar el mismo país que Germany.
6. Como explorador, quiero ver los países ordenados según el idioma elegido.
7. Como explorador, quiero cambiar de idioma sin perder mis filtros, aeropuertos seleccionados ni la ruta consultada.
8. Como explorador, quiero que las tarjetas y tooltips muestren el mismo nombre de país que los filtros.
9. Como explorador, quiero que los países asociados a aeropuertos y rutas respeten mi elección.
10. Como explorador, quiero seguir viendo un nombre útil cuando falta el código de país o su traducción.
11. Como explorador, quiero que las etiquetas traducibles del mapa sigan mi idioma en el tema claro.
12. Como explorador, quiero el mismo comportamiento en el tema oscuro y después de cambiar de tema.
13. Como explorador, quiero conservar etiquetas legibles cuando las teselas no tengan la traducción solicitada.
14. Como usuario, quiero que ciudades de tarjetas y nombres comerciales de aerolíneas conserven su valor original durante esta etapa.
15. Como administrador, quiero conservar los valores originales al editar catálogos, sin que el idioma de visualización se guarde como dato importado.
16. Como operador, quiero que nuevas ejecuciones de ingesta sigan vinculando países y registros sin duplicarlos por traducción.

## Implementation Decisions

- Un único module de preferencia compartida, limitado a es/en, con cookie compatible con SSR; ausencia o valor no admitido vuelve a español. Sin detección automática del navegador ni rutas nuevas por idioma en esta etapa.
- La interface de presentación conserva identidad y nombres originales y calcula etiquetas reactivas; no almacenar traducciones dentro de las colecciones canónicas compartidas. Evitar estado global entre solicitudes SSR y diferencias de hidratación.
- Resolver nombres de países mediante Intl.DisplayNames por ISO alfa-2 válido, con respaldo explícito al original si falta soporte, código o resultado útil. Reutilizar instancias por idioma, no crearlas por etiqueta o fotograma.
- Propagar de forma aditiva y nullable la información ISO necesaria en las consultas de aeropuertos, proximidad y extremos de rutas que la necesiten. No inferir relaciones por nombres traducidos ni imponer códigos inexistentes.
- Mantener IDs como valores de selección. Ordenar las listas completas por el idioma vigente y permitir buscar por nombre original, español o inglés, como en el ejemplo Reino Unido/United Kingdom acordado en el chat; no reordenar solo una página de una consulta paginada como si fuera el catálogo entero.
- Usar las relaciones de país existentes para las vistas; centralizar traducción y respaldo para dar locality y leverage a sus consumidores. Preferir las interfaces existentes y evitar adapters genéricos de proveedores futuros.
- Los editores administrativos mantienen el valor original editable; cualquier etiqueta localizada auxiliar debe estar distinguida y no enviarse como nombre persistido.
- No modificar nombres originales ni claves de ingesta: la importación de países identifica conflictos por nombre y los vínculos inferidos comparan nombres de origen.
- Mantener los contratos existentes compatibles, sin migración de datos prevista. El idioma se aplica en presentación; no añadir idioma a cachés de respuestas canónicas que siguen siendo independientes de él.
- Inspeccionar campos reales de las teselas y expresiones de etiquetas de ambos estilos antes de modificarlos. Elegir el nombre del idioma solicitado cuando exista, luego el nombre original disponible y por último el respaldo actual; no asumir que name_es existe por estar name_en.
- Aplicar idioma al cargar y recargar estilos y al cambiar preferencia. Cubrir todos los puntos de creación del mapa reutilizando la misma regla, sin duplicar listeners ni afectar etiquetas numéricas, expresiones de formato, arcos o selección.
- Mantener MapLibre y Deck.gl exclusivamente en cliente. No recrear el mapa ni descargar catálogos de nuevo solo por cambiar el idioma; no procesar traducciones en el bucle de render.
- Nuxt I18n, ciudades de los datos y textos generales quedan para una etapa posterior, que reutilizará esta preferencia. Los topónimos dibujados por el mapa sí podrán cambiar si la fuente ofrece nombres localizados.

## Testing Decisions

- Superficies propuestas: controles visibles y estado de selección para el flujo de usuario; contratos HTTP existentes para los campos ISO; carga de estilos del mapa para etiquetas. Los tests verifican resultados observables, no una jerarquía nueva de módulos.
- Reutilizar los patrones actuales de pruebas del selector de países, catálogo compartido, búsqueda de aeropuerto, encabezado y ciclo de vida del mapa; ampliar sus fixtures con país vinculado, no vinculado e ISO ausente.
- Verificar español inicial, inglés, cookie persistente, cookie inválida, SSR sin WebGL y cambio sin errores de hidratación.
- Verificar Germany/Alemania, orden y búsqueda localizados, país seleccionado estable, tarjetas/tooltips coherentes y respaldo al original para códigos ausentes o no resolubles.
- Comprobar que las respuestas mantienen campos anteriores, IDs, nulos y filtros por país; no se pierde el ISO en las distintas proyecciones ni se altera la búsqueda existente de ciudades, IATA o ICAO.
- Probar mapa claro/oscuro, cambio de tema, cambios rápidos de idioma, recarga de estilo, ausencia de campos localizados y conservación de etiquetas no geográficas.
- Los mocks de MapLibre verifican el ciclo de estilo, pero no demuestran cobertura de teselas. Realizar una comprobación visual real de ambos temas, registrar los campos observados y las limitaciones del proveedor; no prometer cobertura mundial ni 60 FPS medidos con mocks.
- Antes de dar por implementada la funcionalidad: verificar PostgreSQL y Redis activos, compilación backend/frontend, npm test en ambos, ausencia de any injustificado y limpieza de Git. Registrar errores preexistentes o limitaciones reales sin afirmar un Quality Gate verde si falla.

## Out of Scope

- Traducción de ciudades y nombres de aeropuertos del catálogo; búsqueda por equivalencias de ciudades.
- Traducción de marcas de aerolíneas, botones, validaciones, mensajes, continentes y metadatos generales.
- Instalación de Nuxt I18n, URLs localizadas, traducción automática remota, preferencias por cuenta y nuevos idiomas.
- Sustitución de proveedor cartográfico, nuevas fuentes masivas, migraciones o refactorización general del catálogo.
- Responsables y estimaciones temporales.

## Further Notes

- La cobertura mundial de ISO de la base y de nombres localizados en teselas no se ha verificado. Se inspeccionaron metadatos CARTO v1 y una tesela real con name:es, name:en y name_en; el estilo oscuro actual utiliza CARTO v2 y se confirmó name:es/name:en en una tesela real. El respaldo al original forma parte del resultado aceptado; cualquier cambio de proveedor requiere otra decisión.
- Los tickets son cortes demostrables, no tareas separadas por frontend/backend. El primero habilita la preferencia; los otros dos pueden avanzar en paralelo después.
- No hay tracker externo configurado para este trabajo. Por pedido explícito del usuario se conservan spec y tickets versionables dentro del repositorio, fuera de la carpeta de trabajo ignorada.
- Fuentes técnicas consultadas: [Intl.DisplayNames](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames) y [selector de Nuxt I18n para la etapa futura](https://i18n.nuxtjs.org/docs/guide/lang-switcher).

## Plan de entrega

| Ticket | Entrega demostrable | Bloqueado por |
| --- | --- | --- |
| [01](issues/01-selector-y-paises.md) | Selector persistente y países localizados en filtros | Ninguno |
| [02](issues/02-paises-en-exploracion.md) | Países coherentes en tarjetas y tooltips de aeropuertos y rutas | 01 |
| [03](issues/03-etiquetas-del-mapa.md) | Etiquetas del mapa según idioma en ambos temas | 01 |

La feature está completa cuando los tres cortes y el Quality Gate pasan. No se agregan tickets separados de infraestructura, refactor o pruebas sin comportamiento entregable.
