# Evolución futura del modelo de datos

Estas capacidades quedan fuera de la implementación inmediata. Se incorporarán cuando existan fuentes o necesidades concretas que las justifiquen.

| Cuando se incorpore… | Agregar… |
|---|---|
| Primera fuente de vuelos | Resolución de aeropuertos y aerolíneas, importación idempotente y agregación mensual verificable desde vuelos. |
| Otra fuente de catálogos | `IdentificadorExternoAeropuerto` e `IdentificadorExternoAerolinea`, conservando proveedor e ID externo y manteniendo los IDs internos. |
| Proveedores con vuelos superpuestos | Reconciliación de operaciones antes de combinar sus métricas. |
| Datos de conexiones completas | `Itinerario` y `TramoItinerario`, con `itinerarioId`, `posicion` y `rutaId`. Posiciones únicas y continuidad entre extremos; sin relación recursiva. |
| Correspondencia fiable entre vuelo y oferta | `Vuelo.rutaId` opcional; nunca asignarlo por una coincidencia ambigua. |
| Historia comercial | Intervalos de vigencia y relaciones explícitas entre aerolínea operadora y comercializadoras. |
| Reconstrucción de modificaciones | Historial de versiones y relaciones con los insumos de cada cálculo. |

Un tramo es una etapa del recorrido: EZE → GRU → MAD tiene dos tramos. Los `.dat` actuales indican cantidad de escalas, pero no permiten reconstruirlas. El período de una métrica describe los vuelos; la fecha de su ejecución describe cuándo se calculó.
