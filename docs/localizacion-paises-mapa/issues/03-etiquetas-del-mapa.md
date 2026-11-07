# 03: Etiquetas del mapa en el idioma elegido

**What to build:** Ver los topónimos disponibles del mapa base en español o inglés, en ambos temas y después de cambiar de tema, con respaldo legible cuando la fuente carece de traducción.

**Blocked by:** 01: Selector persistente y países localizados en filtros.

**Status:** in-review — implementación autorizada; pendiente de QA independiente.

**Spec:** [Especificación](../spec.md).

- [ ] Se registra evidencia de campos realmente disponibles y etiquetas observadas en teselas de los estilos claro y oscuro; no se supone cobertura por el nombre del campo de un estilo.
- [ ] Se elige el nombre del idioma activo cuando existe y no está vacío; si falta se conserva un nombre original o el respaldo actual, sin dejar etiquetas vacías.
- [ ] La preferencia se aplica al primer estilo cargado, al alternar idioma y tras cada cambio de tema, en todos los puntos de creación de mapa existentes.
- [ ] No se destruye el mapa para cambiar idioma, no se duplican listeners y cambios rápidos no reaplican una preferencia obsoleta.
- [ ] Las etiquetas numéricas y el formato del estilo se conservan; arcos, cámara, selección y navegación siguen funcionando.
- [ ] No se inicializa WebGL durante SSR ni se ejecutan traducciones en cada fotograma; no se introduce otro proveedor.
- [ ] Pruebas del ciclo de estilo y respaldo, revisión visual real en ambos temas, compilaciones y suites de backend/frontend pasan; se documenta cualquier topónimo sin traducción.
