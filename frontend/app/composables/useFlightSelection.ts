import { type Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { type MapPickingInfo } from "~/types/map";
import { SEED_ROUTES } from "~/data/seedData";

export const useFlightSelection = () => {
  // Estado base
  const selectedOrigin = useState<string | null>("flight_origin", () => null);
  const selectedDestination = useState<string | null>(
    "flight_destination",
    () => null,
  );
  const hoveredEntity = useState<MapPickingInfo>("flight_hovered", () => null);
  const activeScenarioId = useState<string | null>("flight_scenario_id", () => null);
  const mapFitTrigger = useState<number>("flight_map_fit_trigger", () => 0);

  // Estado computado
  const activeRouteId = computed<string | null>(() => {
    if (selectedOrigin.value && selectedDestination.value) {
      return `${selectedOrigin.value}-${selectedDestination.value}`;
    }
    return null;
  });

  const hasActiveRoute = computed<boolean>(() => {
    return Boolean(selectedOrigin.value && selectedDestination.value);
  });

  const hasAnySelection = computed<boolean>(() => {
    return Boolean(selectedOrigin.value || selectedDestination.value);
  });

  const selectedRouteData = computed<FlightRoute | null>(() => {
    if (!selectedOrigin.value && !selectedDestination.value) return null;
    if (selectedOrigin.value && selectedDestination.value) {
      return (
        SEED_ROUTES.find(
          (route) =>
            route.id === `${selectedOrigin.value}-${selectedDestination.value}` ||
            route.id === `${selectedDestination.value}-${selectedOrigin.value}`,
        ) ?? null
      );
    }
    return null;
  });

  /**
   * Rutas coincidentes con el input actual:
   * - Si se selecciona solo origen: devuelve todas las rutas que salen o llegan a ese origen (visión HUB).
   * - Si se seleccionan origen y destino: devuelve la ruta directa y las opciones con escala / conectadas.
   * - Si no hay selección: devuelve la totalidad de rutas del dataset.
   */
  const matchingRoutes = computed<FlightRoute[]>(() => {
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;

    if (orig && dest) {
      const direct = SEED_ROUTES.filter(
        (r) =>
          (r.originIata === orig && r.destinationIata === dest) ||
          (r.originIata === dest && r.destinationIata === orig),
      );

      // Conexiones de 1 escala intermedias
      const outgoing = SEED_ROUTES.filter((r) => r.originIata === orig);
      const incoming = SEED_ROUTES.filter((r) => r.destinationIata === dest);
      const connecting: FlightRoute[] = [];

      outgoing.forEach((leg1) => {
        const leg2 = incoming.find(
          (inLeg) => inLeg.originIata === leg1.destinationIata,
        );
        if (leg2 && !direct.some((d) => d.id === leg1.id || d.id === leg2.id)) {
          connecting.push(leg1, leg2);
        }
      });

      return [...direct, ...connecting];
    }

    if (orig) {
      return SEED_ROUTES.filter(
        (r) => r.originIata === orig || r.destinationIata === orig,
      );
    }

    if (dest) {
      return SEED_ROUTES.filter(
        (r) => r.destinationIata === dest || r.originIata === dest,
      );
    }

    return SEED_ROUTES;
  });

  /**
   * Determina si una ruta dada coincide con los filtros activos
   */
  function isRouteMatched(route: FlightRoute): boolean {
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;

    if (!orig && !dest) return true;

    if (orig && dest) {
      if (
        (route.originIata === orig && route.destinationIata === dest) ||
        (route.originIata === dest && route.destinationIata === orig)
      ) {
        return true;
      }
      return matchingRoutes.value.some((r) => r.id === route.id);
    }

    if (orig) {
      return route.originIata === orig || route.destinationIata === orig;
    }

    if (dest) {
      return route.destinationIata === dest || route.originIata === dest;
    }

    return false;
  }

  // Hooks

  /**
   * Valida y setea el origen según el input de usuario
   * @param airport Aeropuerto o código IATA
   */
  function setOrigin(airport?: Airport | string | null): void {
    const iata = typeof airport === "string" ? airport : airport?.iata ?? null;

    if (!iata) {
      selectedOrigin.value = null;
      return;
    }

    if (selectedOrigin.value === iata) {
      selectedOrigin.value = null;
      return;
    }

    if (selectedDestination.value === iata) {
      selectedDestination.value = null;
    }

    selectedOrigin.value = iata;
    activeScenarioId.value = null;
  }

  /**
   * Valida y setea el destino según el input de usuario
   * @param airport Aeropuerto o código IATA
   */
  function setDestination(airport?: Airport | string | null): void {
    const iata = typeof airport === "string" ? airport : airport?.iata ?? null;

    if (!iata) {
      selectedDestination.value = null;
      return;
    }

    if (selectedDestination.value === iata) {
      selectedDestination.value = null;
      return;
    }

    if (selectedOrigin.value === iata) {
      selectedOrigin.value = null;
    }

    selectedDestination.value = iata;
    activeScenarioId.value = null;
  }

  /**
   * Setea la ruta que seleccionó el usuario
   */
  function setRoute(originIata: string | null, destIata: string | null): void {
    if (originIata && destIata && originIata === destIata) {
      selectedOrigin.value = originIata;
      selectedDestination.value = null;
      activeScenarioId.value = null;
      return;
    }
    selectedOrigin.value = originIata;
    selectedDestination.value = destIata;
    activeScenarioId.value = null;
  }

  /**
   * Aplica un escenario preconfigurado de prueba
   */
  function applyScenario(scenario: {
    id?: string;
    originIata: string | null;
    destinationIata: string | null;
  }): void {
    activeScenarioId.value = scenario.id ?? null;
    selectedOrigin.value = scenario.originIata;
    selectedDestination.value = scenario.destinationIata;
  }

  /**
   * Intercambia los aeropuertos seleccionados
   */
  function swapAirports(): void {
    const temp = selectedOrigin.value;
    selectedOrigin.value = selectedDestination.value;
    selectedDestination.value = temp;
  }

  /**
   * Limpia los inputs seleccionados y restablece el mapa
   */
  function clearSelection(): void {
    selectedOrigin.value = null;
    selectedDestination.value = null;
    activeScenarioId.value = null;
  }

  /**
   * Define y setea el elemento que está debajo del mouse
   */
  function setHoveredEntity(info: MapPickingInfo): void {
    hoveredEntity.value = info;
  }

  /**
   * Limpia la entidad debajo del mouse
   */
  function clearHoveredEntity(): void {
    hoveredEntity.value = null;
  }

  /**
   * Dispara una solicitud para reencuadrar la cámara sobre la selección activa
   */
  function triggerFit(): void {
    mapFitTrigger.value++;
  }

  return {
    selectedOrigin,
    selectedDestination,
    hoveredEntity,
    activeRouteId,
    activeScenarioId,
    hasActiveRoute,
    hasAnySelection,
    selectedRouteData,
    matchingRoutes,
    isRouteMatched,
    mapFitTrigger,
    triggerFit,
    setOrigin,
    setDestination,
    setRoute,
    applyScenario,
    swapAirports,
    clearSelection,
    setHoveredEntity,
    clearHoveredEntity,
  };
};

export default useFlightSelection;
