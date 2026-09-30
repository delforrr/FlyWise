import { computed } from "vue";
import { type Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { type MapPickingInfo } from "~/types/map";
import { findRouteBetween, queryMatchingRoutes } from "../utils/routeGraph";

let hoverRafId: number | null = null;

export const useFlightSelection = () => {
  // Estado base (usar undefined en lugar de null para compatibilidad estricta con UInputMenu de Nuxt UI)
  const selectedOrigin = useState<string | undefined>("flight_origin", () => undefined);
  const selectedDestination = useState<string | undefined>(
    "flight_destination",
    () => undefined,
  );
  const hoveredEntity = useState<MapPickingInfo>("flight_hovered", () => null);
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
    return findRouteBetween(selectedOrigin.value, selectedDestination.value);
  });

  /**
   * Rutas coincidentes con el input actual:
   * Delegado al módulo de grafo O(1) routeGraph.ts (SRP).
   */
  const matchingRoutes = computed<FlightRoute[]>(() => {
    return queryMatchingRoutes(selectedOrigin.value, selectedDestination.value);
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
  }

  /**
   * Setea la ruta que seleccionó el usuario
   */
  function setRoute(originIata?: string | null, destIata?: string | null): void {
    if (originIata && destIata && originIata === destIata) {
      selectedOrigin.value = originIata;
      selectedDestination.value = undefined;
      return;
    }
    selectedOrigin.value = originIata ?? undefined;
    selectedDestination.value = destIata ?? undefined;
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
    swapAirports,
    clearSelection,
    setHoveredEntity,
    clearHoveredEntity,
  };
};

export default useFlightSelection;
