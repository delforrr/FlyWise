import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de maplibre-gl y @deck.gl/mapbox
const mockEaseTo = vi.fn();
const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockFlyTo = vi.fn();
const mockFitBounds = vi.fn();
const mockSetStyle = vi.fn();
const mockRemove = vi.fn();
const mockAddControl = vi.fn();
const mockRemoveControl = vi.fn();

const mockMap = {
  easeTo: mockEaseTo,
  zoomIn: mockZoomIn,
  zoomOut: mockZoomOut,
  flyTo: mockFlyTo,
  fitBounds: mockFitBounds,
  setStyle: mockSetStyle,
  remove: mockRemove,
  addControl: mockAddControl,
  removeControl: mockRemoveControl,
  getPitch: vi.fn(() => 30),
  getZoom: vi.fn(() => 2.5),
  getBearing: vi.fn(() => 0),
  loaded: vi.fn(() => true),
  resize: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
};

const mockOverlay = {
  setProps: vi.fn(),
  finalize: vi.fn(),
};

vi.mock("maplibre-gl", () => {
  class LngLatBounds {
    sw: any;
    ne: any;
    constructor(sw: any, ne: any) {
      this.sw = sw;
      this.ne = ne;
    }
    extend = vi.fn();
  }
  return {
    Map: vi.fn(() => mockMap),
    LngLatBounds,
    default: {
      Map: vi.fn(() => mockMap),
      LngLatBounds,
    },
  };
});

vi.mock("@deck.gl/mapbox", () => ({
  MapboxOverlay: vi.fn(() => mockOverlay),
}));

const mockFlightSelection = {
  setHoveredEntity: vi.fn(),
  clearHoveredEntity: vi.fn(),
  setRoute: vi.fn(),
  setOrigin: vi.fn(),
  setDestination: vi.fn(),
  selectedRouteData: { value: null },
  selectedOrigin: { value: undefined },
  selectedDestination: { value: undefined },
  matchingRoutes: { value: [] },
};
(globalThis as any).useFlightSelection = () => mockFlightSelection;

import { useFlightMap } from "../../app/features/flight-map/composables/useFlightMap";

describe("useFlightMap — Composable de Control de Cámara y Capas Aeronáuticas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Operaciones de cámara sin mapa inicializado (Resiliencia SSR)", () => {
    it("no lanza errores al invocar métodos de navegación cuando mapInstance es null", () => {
      const flightMap = useFlightMap();
      flightMap.destroyMap();

      expect(() => {
        flightMap.toggle3D();
        flightMap.resetNorth();
        flightMap.zoomIn();
        flightMap.zoomOut();
        flightMap.flyToAirport([-58.53, -34.82]);
        flightMap.fitRoute();
        flightMap.fitHub("EZE");
        flightMap.setBaseMapStyle("style-url");
      }).not.toThrow();

      expect(mockEaseTo).not.toHaveBeenCalled();
      expect(mockZoomIn).not.toHaveBeenCalled();
    });
  });

  describe("Navegación de Cámara con Mapa Inicializado", () => {
    beforeEach(() => {
      const flightMap = useFlightMap();
      flightMap.mapInstance.value = mockMap as any;
      flightMap.overlayInstance.value = mockOverlay as any;
    });

    it("toggle3D() alterna a vista 2D cenital (pitch 0, bearing 0) si el pitch actual es > 0", () => {
      const flightMap = useFlightMap();
      flightMap.currentPitch.value = 35;

      flightMap.toggle3D();

      expect(mockEaseTo).toHaveBeenCalledWith({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    });

    it("toggle3D() alterna a perspectiva isométrica 3D (pitch 36) si el pitch actual es 0", () => {
      const flightMap = useFlightMap();
      flightMap.currentPitch.value = 0;
      flightMap.currentBearing.value = 45;

      flightMap.toggle3D();

      expect(mockEaseTo).toHaveBeenCalledWith({
        pitch: 36,
        bearing: 45,
        duration: 1000,
      });
    });

    it("resetNorth() restablece la brújula aeronáutica al rumbo 0° con animación suave", () => {
      const flightMap = useFlightMap();
      flightMap.resetNorth();

      expect(mockEaseTo).toHaveBeenCalledWith({
        bearing: 0,
        duration: 1000,
      });
    });

    it("zoomIn() y zoomOut() despachan comandos de acercamiento/alejamiento a MapLibre", () => {
      const flightMap = useFlightMap();
      flightMap.zoomIn();
      expect(mockZoomIn).toHaveBeenCalledWith({ duration: 400 });

      flightMap.zoomOut();
      expect(mockZoomOut).toHaveBeenCalledWith({ duration: 400 });
    });

    it("flyToAirport() centra la cámara en el aeropuerto especificado con parámetros aeronáuticos", () => {
      const flightMap = useFlightMap();
      flightMap.flyToAirport([-58.5358, -34.8222], 5);

      expect(mockFlyTo).toHaveBeenCalledWith({
        center: [-58.5358, -34.8222],
        zoom: 5,
        pitch: 40,
        speed: 1.2,
        curve: 1.42,
        essential: true,
      });
    });

    it("setBaseMapStyle() actualiza el estilo vectorial del mapa", () => {
      const flightMap = useFlightMap();
      flightMap.setBaseMapStyle("https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json");

      expect(mockSetStyle).toHaveBeenCalledWith(
        "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      );
    });

    it("updateLayers() actualiza las capas WebGL en la GPU a través de overlayInstance.setProps()", () => {
      const flightMap = useFlightMap();
      flightMap.updateLayers();

      expect(mockOverlay.setProps).toHaveBeenCalledTimes(1);
      expect(mockOverlay.setProps).toHaveBeenCalledWith(
        expect.objectContaining({
          layers: expect.any(Array),
        }),
      );
    });

    it("destroyMap() remueve controles, destruye la instancia de mapa y resetea estados", () => {
      const flightMap = useFlightMap();
      flightMap.destroyMap();

      expect(mockMap.removeControl).toHaveBeenCalled();
      expect(mockMap.remove).toHaveBeenCalled();
      expect(flightMap.mapInstance.value).toBeNull();
      expect(flightMap.overlayInstance.value).toBeNull();
      expect(flightMap.isLoaded.value).toBe(false);
      expect(flightMap.currentPitch.value).toBe(0);
      expect(flightMap.currentZoom.value).toBe(0);
    });
  });
});
