import { describe, it, expect } from "vitest";
import {
  getVisibleAirports as getVisibleFromCatalog,
  buildFlightMapLayers,
  type BuildLayersOptions,
} from "../../app/features/flight-map/utils/mapLayers";
import { SEED_AIRPORTS as AIRPORT_FIXTURES, SEED_ROUTES } from "../../app/data/seedData";
import type { FlightRoute } from "../../app/types/route";

const SEED_AIRPORTS = AIRPORT_FIXTURES.map(a => ({ ...a, id: a.iata }));
const getVisibleAirports = (hasSelection: boolean, origen?: string | null, destino?: string | null, rutas: FlightRoute[] = []) => getVisibleFromCatalog(hasSelection, origen, destino, rutas, SEED_AIRPORTS);

describe("mapLayers — Generación de Capas WebGL Deck.gl y Lógica Espacial", () => {
  describe("getVisibleAirports() — Filtrado reactivo de nodos aeroportuarios", () => {
    it("oculta todos los aeropuertos cuando el filtro global no tiene conexiones", () => {
      const result = getVisibleAirports(false, null, null, []);
      expect(result).toEqual([]);
    });

    it('muestra solo los extremos de las conexiones globales, también en etiquetas', () => {
      const rutas = SEED_ROUTES.slice(0, 1);
      const expected = getVisibleAirports(false, null, null, rutas);
      const ids = new Set(rutas.flatMap(r => [r.origenId, r.destinoId]));
      expect(expected).toEqual(SEED_AIRPORTS.filter(a => ids.has(a.id)));
      const layers = buildFlightMapLayers({ isLight: true, aeropuertos: SEED_AIRPORTS, matchingRoutes: rutas });
      expect(layers.find(l => l.id === 'aeropuertos-labels')?.props.data).toEqual(expected);
      expect(layers.find(l => l.id === 'aeropuertos-nodes')?.props.data).toEqual(expected);
    });

    it("filtra solo los aeropuertos involucrados cuando hay un origen seleccionado", () => {
      const originIata = "EZE";
      const connectedRoutes = SEED_ROUTES.filter((r) => r.originIata === originIata);
      const result = getVisibleAirports(true, originIata, null, connectedRoutes);

      // Debe incluir el origen
      expect(result.some((a) => a.iata === originIata)).toBe(true);

      // Debe incluir los destinos de las rutas conectadas
      for (const route of connectedRoutes) {
        expect(result.some((a) => a.iata === route.destinationIata)).toBe(true);
      }

      // NO debe incluir aeropuertos no relacionados
      const unrelated = SEED_AIRPORTS.find(
        (a) =>
          a.iata !== originIata &&
          !connectedRoutes.some((r) => r.destinationIata === a.iata),
      );
      if (unrelated) {
        expect(result.some((a) => a.iata === unrelated.iata)).toBe(false);
      }
    });

    it("filtra solo los aeropuertos involucrados cuando hay un destino seleccionado", () => {
      const destIata = "MAD";
      const connectedRoutes = SEED_ROUTES.filter((r) => r.destinationIata === destIata);
      const result = getVisibleAirports(true, null, destIata, connectedRoutes);

      expect(result.some((a) => a.iata === destIata)).toBe(true);
      for (const route of connectedRoutes) {
        expect(result.some((a) => a.iata === route.originIata)).toBe(true);
      }
    });

    it("deduplica aeropuertos si un nodo aparece múltiples veces en las rutas activas", () => {
      const mockRoutes: FlightRoute[] = [
        {
          id: "R-1",
          numeroVuelo: "AR1300",
          aerolinea: "Aerolineas Argentinas",
          iataAerolinea: "AR",
          origenId: "EZE",
          destinoId: "MIA",
        originIata: "EZE",
          originCity: "Buenos Aires",
          originCoordinates: [-58.5358, -34.8222],
          destinationIata: "MIA",
          destinationCity: "Miami",
          destinationCoordinates: [-80.2906, 25.7959],
          distanciaKm: 7100,
          averageOtp15: 86.5,
          vuelosTotales: 300,
          delayMinutesAvg: 12,
        },
        {
          id: "R-2",
          numeroVuelo: "AA900",
          aerolinea: "American Airlines",
          iataAerolinea: "AA",
          origenId: "EZE",
          destinoId: "MIA",
        originIata: "EZE",
          originCity: "Buenos Aires",
          originCoordinates: [-58.5358, -34.8222],
          destinationIata: "MIA",
          destinationCity: "Miami",
          destinationCoordinates: [-80.2906, 25.7959],
          distanciaKm: 7100,
          averageOtp15: 82.0,
          vuelosTotales: 250,
          delayMinutesAvg: 15,
        },
      ];

      const result = getVisibleAirports(true, "EZE", "MIA", mockRoutes);
      const iatas = result.map((a) => a.iata);
      const uniqueIatas = new Set(iatas);

      expect(iatas.length).toBe(uniqueIatas.size);
      expect(result.some((a) => a.iata === "EZE")).toBe(true);
      expect(result.some((a) => a.iata === "MIA")).toBe(true);
    });

    it("maneja códigos IATA no registrados en SEED_AIRPORTS sin lanzar excepciones", () => {
      const result = getVisibleAirports(true, "XYZ_NON_EXISTENT", null, []);
      expect(Array.isArray(result)).toBe(true);
      expect(result.find((a) => a.iata === "XYZ_NON_EXISTENT")).toBeUndefined();
    });
  });

  describe("buildFlightMapLayers() — Construcción de Capas Deck.gl WebGL", () => {
    it("INVARIANTE RNF-02: Sin selección activa muestra las rutas recibidas del backend", () => {
      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: null,
        selectedDestination: null,
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: SEED_ROUTES,
      };

      const layers = buildFlightMapLayers(options);
      expect(layers.length).toBeGreaterThanOrEqual(3);

      const arcLayer = layers.find((l) => l.id === "flight-rutas-arc");
      expect(arcLayer).toBeDefined();
      // Verificamos que la capa de arcos no tenga datos a renderizar
      expect(arcLayer?.props.data).toEqual(SEED_ROUTES);
    });

    it("con selección activa genera datos en la capa ArcLayer con greatCircle = true", () => {
      const rutas = SEED_ROUTES.slice(0, 3);
      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "EZE",
        selectedDestination: null,
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: rutas,
      };

      const layers = buildFlightMapLayers(options);
      const arcLayer = layers.find((l) => l.id === "flight-rutas-arc");

      expect(arcLayer).toBeDefined();
      expect(arcLayer?.props.data).toEqual(rutas);
      expect(arcLayer?.props.greatCircle).toBe(true);
      expect(arcLayer?.props.pickable).toBe(true);
    });

    it("configura capas de soporte: scatterplot de nodos core y capas de texto para etiquetas", () => {
      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "EZE",
        selectedDestination: "MIA",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: SEED_ROUTES.filter((r) => r.originIata === "EZE" && r.destinationIata === "MIA"),
      };

      const layers = buildFlightMapLayers(options);
      const nodesLayer = layers.find((l) => l.id === "aeropuertos-nodes");
      const labelsLayer = layers.find((l) => l.id === "aeropuertos-labels");
      const haloLayer = layers.find((l) => l.id === "aeropuertos-radar-halo");
      const ringLayer = layers.find((l) => l.id === "aeropuertos-radar-ring-outer");

      expect(nodesLayer).toBeDefined();
      expect(labelsLayer).toBeDefined();
      expect(haloLayer).toBeDefined();
      expect(ringLayer).toBeDefined();

      // Los halos de radar solo contienen los aeropuertos seleccionados
      const haloData = haloLayer?.props.data as any[];
      expect(haloData.map((a) => a.iata)).toEqual(expect.arrayContaining(["EZE", "MIA"]));
    });

    it("aplica esquema de colores contrastantes en modo claro (isLight = true)", () => {
      const optionsLight: BuildLayersOptions = {
        isLight: true,
        selectedOrigin: "EZE",
        selectedDestination: "MIA",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: SEED_ROUTES.slice(0, 2),
      };

      const layersLight = buildFlightMapLayers(optionsLight);
      const arcLayer = layersLight.find((l) => l.id === "flight-rutas-arc");
      expect(arcLayer?.props.highlightColor).toEqual([2, 132, 199, 255]);
    });

    it("aplica esquema de colores en modo oscuro (isLight = false)", () => {
      const optionsDark: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "EZE",
        selectedDestination: "MIA",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: SEED_ROUTES.slice(0, 2),
      };

      const layersDark = buildFlightMapLayers(optionsDark);
      const arcLayer = layersDark.find((l) => l.id === "flight-rutas-arc");
      expect(arcLayer?.props.highlightColor).toEqual([56, 189, 248, 255]);
    });

    it("evalúa correctamente los accesores de color getSourceColor y getTargetColor en las rutas", () => {
      const directRoute: FlightRoute = {
        id: "R-DIR",
        numeroVuelo: "TEST1",
        aerolinea: "Test Air",
        iataAerolinea: "TA",
        origenId: "EZE",
        destinoId: "MIA",
        originIata: "EZE",
        originCity: "Buenos Aires",
        originCoordinates: [-58.5358, -34.8222],
        destinationIata: "MIA",
        destinationCity: "Miami",
        destinationCoordinates: [-80.2906, 25.7959],
        distanciaKm: 7100,
        averageOtp15: 90.0,
        vuelosTotales: 100,
        delayMinutesAvg: 10,
      };

      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "EZE",
        selectedDestination: "MIA",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: [directRoute],
      };

      const layers = buildFlightMapLayers(options);
      const arcLayer = layers.find((l) => l.id === "flight-rutas-arc");
      expect(arcLayer).toBeDefined();

      const getSourceColor = (arcLayer?.props as any).getSourceColor;
      const getTargetColor = (arcLayer?.props as any).getTargetColor;

      expect(typeof getSourceColor).toBe("function");
      expect(typeof getTargetColor).toBe("function");

      const sourceColor = getSourceColor(directRoute);
      const targetColor = getTargetColor(directRoute);

      // Origen activo seleccionado en modo oscuro es Aero Cyan [56, 189, 248, 255]
      expect(sourceColor).toEqual([56, 189, 248, 255]);
      // Destino activo con OTP 90 >= 85 es Emerald [16, 185, 129, 255]
      expect(targetColor).toEqual([16, 185, 129, 255]);
    });

    it("soporta rutas con coordenadas en el antimeridiano (-180° / +180°) y polos sin distorsión", () => {
      const antimeridianRoute: FlightRoute = {
        id: "R-ANTI",
        numeroVuelo: "NZ1",
        aerolinea: "Air New Zealand",
        iataAerolinea: "NZ",
        originIata: "AKL",
        originCity: "Auckland",
        originCoordinates: [174.79, -37.0],
        destinationIata: "RAR",
        destinationCity: "Rarotonga",
        destinationCoordinates: [-159.8, -21.2],
        distanciaKm: 3000,
        averageOtp15: 88.0,
        vuelosTotales: 90,
        delayMinutesAvg: 8,
      };

      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "AKL",
        selectedDestination: "RAR",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: [antimeridianRoute],
      };

      const layers = buildFlightMapLayers(options);
      const arcLayer = layers.find((l) => l.id === "flight-rutas-arc");
      expect(arcLayer).toBeDefined();

      const getSourcePos = (arcLayer?.props as any).getSourcePosition;
      const getTargetPos = (arcLayer?.props as any).getTargetPosition;

      expect(getSourcePos(antimeridianRoute)).toEqual([174.79, -37.0]);
      expect(getTargetPos(antimeridianRoute)).toEqual([-159.8, -21.2]);
      expect(arcLayer?.props.greatCircle).toBe(true);
    });

    it("distingue el grosor y opacidad entre la ruta directa activa (8px) y rutas secundarias de escala (3px)", () => {
      const directRoute: FlightRoute = {
        id: "R-DIR",
        numeroVuelo: "AR1300",
        aerolinea: "Aerolineas Argentinas",
        iataAerolinea: "AR",
        origenId: "EZE",
        destinoId: "MIA",
        originIata: "EZE",
        originCity: "Buenos Aires",
        originCoordinates: [-58.53, -34.82],
        destinationIata: "MIA",
        destinationCity: "Miami",
        destinationCoordinates: [-80.29, 25.79],
        distanciaKm: 7100,
        averageOtp15: 85.0,
        vuelosTotales: 100,
        delayMinutesAvg: 10,
      };

      const connectingRoute: FlightRoute = {
        id: "R-CONN",
        numeroVuelo: "LA500",
        aerolinea: "LATAM",
        iataAerolinea: "LA",
        origenId: "EZE",
        destinoId: "SCL",
        originIata: "EZE",
        originCity: "Buenos Aires",
        originCoordinates: [-58.53, -34.82],
        destinationIata: "SCL",
        destinationCity: "Santiago",
        destinationCoordinates: [-70.79, -33.39],
        distanciaKm: 1150,
        averageOtp15: 78.0,
        vuelosTotales: 150,
        delayMinutesAvg: 18,
      };

      const options: BuildLayersOptions = {
        isLight: false,
        selectedOrigin: "EZE",
        selectedDestination: "MIA",
        aeropuertos: SEED_AIRPORTS,
        matchingRoutes: [directRoute, connectingRoute],
      };

      const layers = buildFlightMapLayers(options);
      const arcLayer = layers.find((l) => l.id === "flight-rutas-arc");
      const getWidth = (arcLayer?.props as any).getWidth;
      const getSourceColor = (arcLayer?.props as any).getSourceColor;

      // Ruta directa: grosor elevado 8.0
      expect(getWidth(directRoute)).toBe(8.0);
      // Conexión secundaria: grosor atenuado 3.0
      expect(getWidth(connectingRoute)).toBe(3.0);

      // Conexión secundaria: alpha atenuado (140)
      const connColor = getSourceColor(connectingRoute);
      expect(connColor[3]).toBe(140);
    });
  });
});
