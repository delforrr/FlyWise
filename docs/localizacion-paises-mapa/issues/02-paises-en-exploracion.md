# 02: Países localizados durante la exploración de aeropuertos y rutas

**What to build:** Ver el mismo nombre localizado del país en filtros, tarjetas y tooltips durante las consultas de aeropuertos y rutas, conservando el contenido original de ciudades y aerolíneas.

**Blocked by:** 01: Selector persistente y países localizados en filtros.

**Status:** in-review — implementación autorizada; pendiente de QA independiente.

**Spec:** [Especificación](../spec.md).

- [ ] Los contratos de consulta necesarios transportan ISO de forma aditiva y nullable desde la relación real de país, incluidos proximidad y extremos de rutas cuando sean consumidores afectados.
- [ ] Los contratos conservan todos sus campos y las selecciones siguen usando los mismos IDs; no se requieren migraciones de datos.
- [ ] Las tarjetas, tooltips y demás vistas de consulta que muestran países reaccionan al cambio de idioma, incluso si sus datos ya estaban cargados.
- [ ] Un aeropuerto sin relación o ISO conserva su nombre de país original, sin deducir vínculos por textos traducidos.
- [ ] El cambio de idioma no exige recargar catálogos ni muta sus colecciones canónicas; no altera ciudad, nombre comercial, IATA/ICAO, filtros ni ruta seleccionada.
- [ ] Los editores guardan valores originales y no envían etiquetas traducidas como datos de catálogo.
- [ ] Las pruebas de contrato y consumidores cubren relaciones presentes/ausentes y ambos idiomas; compilan y pasan las suites de backend/frontend.
