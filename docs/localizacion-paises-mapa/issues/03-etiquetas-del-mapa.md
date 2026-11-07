# 03: Etiquetas del mapa en el idioma elegido

**What to build:** Ver los topónimos disponibles del mapa base en español o inglés, en ambos temas y después de cambiar de tema, con respaldo legible cuando la fuente carece de traducción.

**Blocked by:** 01: Selector persistente y países localizados en filtros.

**Status:** done — pruebas, revisión y QA visual del mapa completo en producción aprobados.

**Spec:** [Especificación](../spec.md).

- [x] Se registra evidencia de campos realmente disponibles y etiquetas observadas en teselas de los estilos claro y oscuro; no se supone cobertura por el nombre del campo de un estilo.
- [x] Se elige el nombre del idioma activo cuando existe y no está vacío; si falta se conserva un nombre original o el respaldo actual, sin dejar etiquetas vacías.
- [x] La preferencia se aplica al primer estilo cargado, al alternar idioma y tras cada cambio de tema, en todos los puntos de creación de mapa existentes.
- [x] No se destruye el mapa para cambiar idioma, no se duplican listeners y cambios rápidos no reaplican una preferencia obsoleta.
- [x] Las etiquetas numéricas y el formato del estilo se conservan; arcos, cámara, selección y navegación siguen funcionando.
- [x] No se inicializa WebGL durante SSR ni se ejecutan traducciones en cada fotograma; no se introduce otro proveedor.
- [x] Pruebas del ciclo de estilo y respaldo, compilaciones y suites de backend/frontend aprobadas; se verificaron nombres en teselas reales de ambos temas.
- [x] Revisión visual real de ambos temas y documentación de topónimos sin traducción en un navegador con GPU funcional. Ver los límites en [verificación](../verificacion.md).
