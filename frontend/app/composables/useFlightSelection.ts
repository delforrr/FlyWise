import { type Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { type MapPickingInfo } from "~/types/map";
import { SEED_ROUTES } from "~/data/seedData";

// Índices Map precalculados a nivel de módulo para búsquedas O(1) ultra-rápidas
const routeByIdMap = new Map<string, FlightRoute>();
const routesByAirportMap = new Map<string, FlightRoute[]>();
const outgoingRoutesMap = new Map<string, FlightRoute[]>();
const incomingRoutesMap = new Map<string, FlightRoute[]>();

for (const route of SEED_ROUTES) {
  routeByIdMap.set(route.id, route);
  routeByIdMap.set(`${route.originIata}-${route.destinationIata}`, route);

  if (!routesByAirportMap.has(route.originIata)) routesByAirportMap.set(route.originIata, []);
  routesByAirportMap.get(route.originIata)!.push(route);

  if (!routesByAirportMap.has(route.destinationIata)) routesByAirportMap.set(route.destinationIata, []);
  routesByAirportMap.get(route.destinationIata)!.push(route);

  if (!outgoingRoutesMap.has(route.originIata)) outgoingRoutesMap.set(route.originIata, []);
  outgoingRoutesMap.get(route.originIata)!.push(route);

  if (!incomingRoutesMap.has(route.destinationIata)) incomingRoutesMap.set(route.destinationIata, []);
  incomingRoutesMap.get(route.destinationIata)!.push(route);
}

let hoverRafId: number | null = null;

export const useFlightSelection = () => {
  // Estado base (usar undefined en lugar de null para compatibilidad estricta con UInputMenu de Nuxt UI)
  const selectedOrigin = useState<string | undefined>("flight_origin", () => undefined);
  const selectedDestination = useState<string | undefined>(
    "flight_destination",
    () => undefined,
  );
  const hoveredEntity = useState<MapPickingInfo>("flight_hovered", () => null);
  const activeScenarioId = useState<string | undefined>(
    "flight_scenario_id",
    () => undefined,
  );
  const mapFitTrigger = useState<number>("flight_map_fit_trigger", () => 0);
  const isMobileSearchOpen = useState<boolean>(
    "flight_mobile_search_open",
    () => false,
  );

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
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;
    if (!orig || !dest) return null;
    return (
      routeByIdMap.get(`${orig}-${dest}`) ??
      routeByIdMap.get(`${dest}-${orig}`) ??
      null
    );
  });

  /**
   * Rutas coincidentes con el input actual:
   * - Si se selecciona solo origen/destino: devuelve todas las rutas del Hub en O(1).
   * - Si se seleccionan ambos: devuelve directa + conexiones de 1 escala.
   * - Si no hay selección: devuelve la totalidad de rutas.
   */
  const matchingRoutes = computed<FlightRoute[]>(() => {
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;

    if (orig && dest) {
      const directRoute =
        routeByIdMap.get(`${orig}-${dest}`) ??
        routeByIdMap.get(`${dest}-${orig}`);
      const direct = directRoute ? [directRoute] : [];

      const outgoing = outgoingRoutesMap.get(orig) ?? [];
      const incoming = incomingRoutesMap.get(dest) ?? [];
      const incomingByOrigin = new Map<string, FlightRoute>();
      for (const inLeg of incoming) {
        incomingByOrigin.set(inLeg.originIata, inLeg);
      }

      const connecting: FlightRoute[] = [];
      for (const leg1 of outgoing) {
        const leg2 = incomingByOrigin.get(leg1.destinationIata);
        if (leg2 && !direct.some((d) => d.id === leg1.id || d.id === leg2.id)) {
          connecting.push(leg1, leg2);
        }
      }

      return [...direct, ...connecting];
    }

    if (orig) {
      return routesByAirportMap.get(orig) ?? [];
    }

    if (dest) {
      return routesByAirportMap.get(dest) ?? [];
    }

    return SEED_ROUTES;
  });

  // Set de IDs para resolución instantánea O(1)
  const matchingRouteIds = computed<Set<string>>(() => {
    return new Set(matchingRoutes.value.map((r) => r.id));
  });

  /**
   * Determina en O(1) si una ruta dada coincide con los filtros activos
   */
  function isRouteMatched(route: FlightRoute): boolean {
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;

    if (!orig && !dest) return true;
    return matchingRouteIds.value.has(route.id);
  }

  // Hooks

  /**
   * Valida y setea el origen según el input de usuario
   * @param airport Aeropuerto o código IATA
   */
  function setOrigin(airport?: Airport | string | null): void {
    const iata = typeof airport === "string" ? airport : airport?.iata;

    if (!iata) {
      selectedOrigin.value = undefined;
      return;
    }

    if (selectedOrigin.value === iata) {
      selectedOrigin.value = undefined;
      return;
    }

    if (selectedDestination.value === iata) {
      selectedDestination.value = undefined;
    }

    selectedOrigin.value = iata;
    activeScenarioId.value = undefined;
  }

  /**
   * Valida y setea el destino según el input de usuario
   * @param airport Aeropuerto o código IATA
   */
  function setDestination(airport?: Airport | string | null): void {
    const iata = typeof airport === "string" ? airport : airport?.iata;

    if (!iata) {
      selectedDestination.value = undefined;
      return;
    }

    if (selectedDestination.value === iata) {
      selectedDestination.value = undefined;
      return;
    }

    if (selectedOrigin.value === iata) {
      selectedOrigin.value = undefined;
    }

    selectedDestination.value = iata;
    activeScenarioId.value = undefined;
  }

  /**
   * Setea la ruta que seleccionó el usuario
   */
  function setRoute(originIata?: string | null, destIata?: string | null): void {
    if (originIata && destIata && originIata === destIata) {
      selectedOrigin.value = originIata;
      selectedDestination.value = undefined;
      activeScenarioId.value = undefined;
      return;
    }
    selectedOrigin.value = originIata ?? undefined;
    selectedDestination.value = destIata ?? undefined;
    activeScenarioId.value = undefined;
  }

  /**
   * Aplica un escenario preconfigurado de prueba
   */
  function applyScenario(scenario: {
    id?: string;
    originIata?: string | null;
    destinationIata?: string | null;
  }): void {
    activeScenarioId.value = scenario.id ?? undefined;
    selectedOrigin.value = scenario.originIata ?? undefined;
    selectedDestination.value = scenario.destinationIata ?? undefined;
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
    selectedOrigin.value = undefined;
    selectedDestination.value = undefined;
    activeScenarioId.value = undefined;
  }

  /**
   * Define y setea el elemento que está debajo del mouse (con RAF para fluidez de 60 FPS)
   */
  function setHoveredEntity(info: MapPickingInfo): void {
    if (typeof window !== "undefined" && typeof requestAnimationFrame !== "undefined") {
      if (hoverRafId !== null) {
        cancelAnimationFrame(hoverRafId);
      }
      hoverRafId = requestAnimationFrame(() => {
        hoveredEntity.value = info;
        hoverRafId = null;
      });
    } else {
      hoveredEntity.value = info;
    }
  }

  /**
   * Limpia la entidad debajo del mouse
   */
  function clearHoveredEntity(): void {
    if (typeof window !== "undefined" && hoverRafId !== null) {
      cancelAnimationFrame(hoverRafId);
      hoverRafId = null;
    }
    hoveredEntity.value = null;
  }

  /**
   * Dispara una solicitud para reencuadrar la cámara sobre la selección activa
   */
  function triggerFit(): void {
    mapFitTrigger.value++;
  }

  /**
   * Abre y cierra el drawer de búsqueda móvil
   */
  function openMobileSearch(): void {
    isMobileSearchOpen.value = true;
  }

  function closeMobileSearch(): void {
    isMobileSearchOpen.value = false;
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
    isMobileSearchOpen,
    openMobileSearch,
    closeMobileSearch,
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
