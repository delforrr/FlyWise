import { type Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import type { MapPickingInfo } from "~/types/map";
import { SEED_ROUTES } from "~/data/seedData";

export const useFlightSelection = () => {
  // Estado base
  const selectedOrigin = useState<string | null>("flight_origin", () => null);

  const selectedDestination = useState<string | null>(
    "flight_destination",
    () => null,
  );
  
  const hoveredEntity = useState<MapPickingInfo>("flight_hovered", () => null);

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
    if (!activeRouteId.value) return null;
    return SEED_ROUTES.find((route) => route.id === activeRouteId.value) ?? null;
  });

  // Hooks

  /**
   * Valida y setea el origen segun el input de usuario 
   * @param airport es el aeropuerto que se seleccionó como origen
   */
  function setOrigin(airport?: Airport | null): void {
    if (!airport) {
      selectedOrigin.value = null;
      return;
    }

    // Toggle
    if (selectedOrigin.value === airport.iata) {
      selectedOrigin.value = null;
      return;
    }

    // Nuevo origen = destino actual, vacía el destino
    if (selectedDestination.value === airport.iata) {
      selectedDestination.value = null;
    }

    selectedOrigin.value = airport.iata;
  }

  /**
   * Valida y setea el destino segun el input de usuario
   * @param airport es el aeropuerto que se seleccionó como destino
   */
  function setDestination(airport?: Airport | null): void {
    if (!airport) {
      selectedDestination.value = null;
      return;
    }

    // Toggle
    if (selectedDestination.value === airport.iata) {
      selectedDestination.value = null;
      return;
    }

    // Nuevo destino = origen actual, vacía el origen
    if (selectedOrigin.value === airport.iata) {
      selectedOrigin.value = null;
    }

    selectedDestination.value = airport.iata;
  }

  /**
   * Setea la ruta que seleccionó el usuario
   * segun los aeropuertos de origen y destino. Si el origen
   * es igual al destino, se limpia el destino ya que es una 
   * ruta inválida.
   * @param originIata es el código de aeropuerto que se seleccionó como origen
   * @param destIata es el codigo de aeropuerto que se seleccionó como destino
   */
  function setRoute(originIata: string | null, destIata: string | null): void {
    if (originIata && destIata && originIata === destIata) {
      selectedOrigin.value = originIata;
      selectedDestination.value = null;
      return;
    }
    selectedOrigin.value = originIata;
    selectedDestination.value = destIata;
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
   * Limpia los inputs seleccionados
   */
  function clearSelection(): void {
    selectedOrigin.value = null;
    selectedDestination.value = null;
  }

  /**
   * Define y setea el elemento que esta debajo del mouse
   * @param info puede ser tanto una ruta como un aeropuerto,
   * posee coordenadas x e y.
   */
  function setHoveredEntity(info: MapPickingInfo): void {
    hoveredEntity.value = info;
  }

  /**
   * Limpia la entidad debajo del mosue
   */
  function clearHoveredEntity(): void {
    hoveredEntity.value = null;
  }

  return {
    selectedOrigin,
    selectedDestination,
    hoveredEntity,
    activeRouteId,
    hasActiveRoute,
    hasAnySelection,
    selectedRouteData,
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
