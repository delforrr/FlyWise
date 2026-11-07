# 01: Selector persistente y países localizados en filtros

**What to build:** Elegir Español / English y ver de inmediato los nombres de países del selector en el idioma elegido, con búsqueda y orden coherentes y sin perder filtros.

**Blocked by:** Ninguno (puede comenzar inmediatamente).

**Status:** in-review — implementación autorizada; pendiente de QA independiente.

**Spec:** [Especificación](../spec.md).

- [ ] El selector accesible indica su alcance actual: países y mapa; es operable con teclado y expone el valor activo.
- [ ] Español es el valor inicial; English cambia las etiquetas y la elección persiste tras navegación y recarga mediante cookie compatible con SSR.
- [ ] Una cookie inválida vuelve a español sin errores de hidratación ni estado compartido entre solicitudes.
- [ ] La localización usa ISO e Intl.DisplayNames; Germany/Alemania se resuelve, y códigos ausentes o no resolubles conservan el original.
- [ ] Las listas de países se buscan y ordenan según el idioma activo, conservando IDs y filtros seleccionados al alternar.
- [ ] No se modifican nombres persistidos, valores editables administrativos ni reglas de ingesta; no se instala I18n.
- [ ] Las pruebas de interacción, persistencia y respaldo pasan, junto con las compilaciones y suites de ambos proyectos.
