import { describe, it, expect, beforeEach } from "vitest";
import { useFlightSelection } from "../../app/features/route-audit/composables/useFlightSelection";
import type { Aeropuerto } from "../../app/types/airport";
import type { FlightRoute } from "../../app/types/route";

describe("useFlightSelection — Composable de Selección Reactiva de Rutas y Aeropuertos", () => {
  beforeEach(() => {
    (globalThis as any).__clearStateStore?.();
  });

  describe("Estado Inicial", () => {
    it('prevents equal endpoints assigned through input v-models', () => {
      const selection = useFlightSelection();
      selection.selectedOrigin.value = 'PKN';
      selection.selectedDestination.value = 'PKN';
      expect(selection.hasActiveRoute.value).toBe(false);
      expect(selection.selectedDestination.value).toBeUndefined();
    });
    it("inicializa con origen, destino indefinidos y sin entidades hovered", () => {
      const selection = useFlightSelection();

      expect(selection.selectedOrigin.value).toBeUndefined();
      expect(selection.selectedDestination.value).toBeUndefined();
      expect(selection.hoveredEntity.value).toBeNull();
      expect(selection.hasActiveRoute.value).toBe(false);
      expect(selection.hasAnySelection.value).toBe(false);
      expect(selection.activeRouteId.value).toBeNull();
      expect(selection.mapFitTrigger.value).toBe(0);
    });
  });

  describe("Mutaciones de Origen (setOrigin)", () => {
    it("establece el código IATA como origen", () => {
      const selection = useFlightSelection();
      selection.setOrigin("EZE");

      expect(selection.selectedOrigin.value).toBe("EZE");
      expect(selection.hasAnySelection.value).toBe(true);
      expect(selection.hasActiveRoute.value).toBe(false);
    });

    it("acepta un objeto Aeropuerto y conserva su identidad interna", () => {
      const selection = useFlightSelection();
      const mockAirport: Aeropuerto = {
        id: "eze",
        iata: "EZE",
        icao: "SAEZ",
        nombre: "Ezeiza",
        ciudad: "Buenos Aires",
        pais: "Argentina",
        coordenadas: [-58.53, -34.82],
        type: "large_airport",
      };

      selection.setOrigin(mockAirport);
      expect(selection.selectedOrigin.value).toBe("eze");
    });

    it("conmuta a undefined si se selecciona el mismo aeropuerto ya activo (toggle)", () => {
      const selection = useFlightSelection();
      selection.setOrigin("EZE");
      expect(selection.selectedOrigin.value).toBe("EZE");

      selection.setOrigin("EZE");
      expect(selection.selectedOrigin.value).toBeUndefined();
    });

    it("limpia el destino si el nuevo origen coincide con el destino actual", () => {
      const selection = useFlightSelection();
      selection.setDestination("MIA");
      expect(selection.selectedDestination.value).toBe("MIA");

      selection.setOrigin("MIA");
      expect(selection.selectedOrigin.value).toBe("MIA");
      expect(selection.selectedDestination.value).toBeUndefined();
    });
  });

  describe("Mutaciones de Destino (setDestination)", () => {
    it("establece el código IATA como destino", () => {
      const selection = useFlightSelection();
      selection.setDestination("MAD");

      expect(selection.selectedDestination.value).toBe("MAD");
      expect(selection.hasAnySelection.value).toBe(true);
      expect(selection.hasActiveRoute.value).toBe(false);
    });

    it("conmuta a undefined si se vuelve a seleccionar el destino actual", () => {
      const selection = useFlightSelection();
      selection.setDestination("MAD");
      expect(selection.selectedDestination.value).toBe("MAD");

      selection.setDestination("MAD");
      expect(selection.selectedDestination.value).toBeUndefined();
    });

    it("limpia el origen si el nuevo destino coincide con el origen actual", () => {
      const selection = useFlightSelection();
      selection.setOrigin("JFK");
      expect(selection.selectedOrigin.value).toBe("JFK");

      selection.setDestination("JFK");
      expect(selection.selectedDestination.value).toBe("JFK");
      expect(selection.selectedOrigin.value).toBeUndefined();
    });
  });

  describe("Operaciones de Ruta Completa y Swapping", () => {
    it("setRoute() asigna origen y destino simultáneamente activando hasActiveRoute", () => {
      const selection = useFlightSelection();
      selection.setRoute("EZE", "MIA");

      expect(selection.selectedOrigin.value).toBe("EZE");
      expect(selection.selectedDestination.value).toBe("MIA");
      expect(selection.hasActiveRoute.value).toBe(true);
      expect(selection.activeRouteId.value).toBe("EZE-MIA");
    });

    it("setRoute() con origen igual a destino solo define el origen", () => {
      const selection = useFlightSelection();
      selection.setRoute("EZE", "EZE");

      expect(selection.selectedOrigin.value).toBe("EZE");
      expect(selection.selectedDestination.value).toBeUndefined();
      expect(selection.hasActiveRoute.value).toBe(false);
    });

    it("swapAirports() intercambia origen y destino de forma segura", () => {
      const selection = useFlightSelection();
      selection.setRoute("EZE", "MIA");

      selection.swapAirports();

      expect(selection.selectedOrigin.value).toBe("MIA");
      expect(selection.selectedDestination.value).toBe("EZE");
      expect(selection.activeRouteId.value).toBe("MIA-EZE");
    });

    it("clearSelection() restablece origen y destino a undefined", () => {
      const selection = useFlightSelection();
      selection.setRoute("EZE", "MIA");

      selection.clearSelection();

      expect(selection.selectedOrigin.value).toBeUndefined();
      expect(selection.selectedDestination.value).toBeUndefined();
      expect(selection.hasActiveRoute.value).toBe(false);
      expect(selection.hasAnySelection.value).toBe(false);
    });
  });

  describe("Interacción Táctica: Hover, Drawer Móvil y Trigger Fit", () => {
    it("triggerFit() incrementa el contador de señal de reencuadre", () => {
      const selection = useFlightSelection();
      expect(selection.mapFitTrigger.value).toBe(0);

      selection.triggerFit();
      expect(selection.mapFitTrigger.value).toBe(1);

      selection.triggerFit();
      expect(selection.mapFitTrigger.value).toBe(2);
    });

    it("setHoveredEntity() y clearHoveredEntity() gestionan el objeto activo bajo el cursor", async () => {
      const selection = useFlightSelection();
      const mockPickingInfo = {
        type: "airport" as const,
        data: { id: "eze", iata: "EZE" } as any,
        x: 150,
        y: 220,
      };

      selection.setHoveredEntity(mockPickingInfo);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(selection.hoveredEntity.value).toEqual(mockPickingInfo);

      selection.clearHoveredEntity();
      expect(selection.hoveredEntity.value).toBeNull();
    });

    it("openMobileSearch() y closeMobileSearch() controlan el estado del panel móvil", () => {
      const selection = useFlightSelection();
      expect(selection.isMobileSearchOpen.value).toBe(false);

      selection.openMobileSearch();
      expect(selection.isMobileSearchOpen.value).toBe(true);

      selection.closeMobileSearch();
      expect(selection.isMobileSearchOpen.value).toBe(false);
    });
  });
});
