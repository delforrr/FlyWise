import { ArcLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { SEED_AIRPORTS } from "~/data/seedData";
import { getOtpColor } from "./mapUtils";

export interface BuildLayersOptions {
  isLight: boolean;
  selectedOrigin?: string | null;
  selectedDestination?: string | null;
  matchingRoutes: FlightRoute[];
}

/**
 * Determina los aeropuertos visibles según el estado de selección
 */
export function getVisibleAirports(
  hasSelection: boolean,
  orig?: string | null,
  dest?: string | null,
  visibleRoutes: FlightRoute[] = [],
): Airport[] {
  if (!hasSelection) {
    return SEED_AIRPORTS;
  }

  const activeAirportIatas = new Set<string>();
  if (orig) activeAirportIatas.add(orig);
  if (dest) activeAirportIatas.add(dest);

  for (const r of visibleRoutes) {
    activeAirportIatas.add(r.originIata);
    activeAirportIatas.add(r.destinationIata);
  }

  return SEED_AIRPORTS.filter((a) => activeAirportIatas.has(a.iata));
}

/**
 * Genera las capas activas de WebGL (ArcLayer, ScatterplotLayer y Halo Rings).
 * REGLA: El mapa inicia sin arcos hasta que se selecciona un aeropuerto o ruta.
 */
export function buildFlightMapLayers(options: BuildLayersOptions) {
  const { isLight, selectedOrigin: orig, selectedDestination: dest, matchingRoutes } = options;
  const hasSelection = Boolean(orig || dest);
  const hasBoth = Boolean(orig && dest);

  // 1. Filtrar rutas: Sin selección activa NO se renderiza ningún arco
  const visibleRoutes = hasSelection ? matchingRoutes : [];

  // 2. Aeropuertos visibles (despejar pantalla si hay selección, o todos si está en vista general)
  const visibleAirports = getVisibleAirports(
    hasSelection,
    orig,
    dest,
    visibleRoutes,
  );

  // 3. Aeropuertos activos seleccionados (origen y/o destino para halos de radar)
  const activeSelectedAirports = visibleAirports.filter(
    (a) => a.iata === orig || a.iata === dest,
  );

  return [
    // Capa de Arcos Geodésicos 3D (Rutas y puntualidad OTP-15)
    new ArcLayer<FlightRoute>({
      id: "flight-routes-arc",
      data: visibleRoutes,
      pickable: true,
      autoHighlight: true,
      highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255],
      greatCircle: true,
      getSourcePosition: (d: FlightRoute) => d.originCoordinates,
      getTargetPosition: (d: FlightRoute) => d.destinationCoordinates,
      getSourceColor: (d: FlightRoute) => {
        const isDirectActive = Boolean(
          hasBoth &&
          ((d.originIata === orig && d.destinationIata === dest) ||
            (d.originIata === dest && d.destinationIata === orig)),
        );

        if (isDirectActive) {
          // Gradiente de alto contraste para la ruta activa seleccionada:
          // El origen emite en Aero Cyan de alta saturación
          return d.originIata === orig
            ? isLight
              ? [2, 132, 199, 255]
              : [56, 189, 248, 255]
            : getOtpColor(d.averageOtp15, 255);
        }

        if (hasBoth) {
          // Rutas de escala / conexión secundarias: contraste atenuado
          const baseColor = getOtpColor(d.averageOtp15, 140);
          return [baseColor[0], baseColor[1], baseColor[2], 140];
        }

        if (orig && d.originIata === orig) {
          return isLight ? [2, 132, 199, 240] : [56, 189, 248, 240];
        }

        const baseColor = getOtpColor(d.averageOtp15, 220);
        return [baseColor[0], baseColor[1], baseColor[2], 220];
      },
      getTargetColor: (d: FlightRoute) => {
        const isDirectActive = Boolean(
          hasBoth &&
          ((d.originIata === orig && d.destinationIata === dest) ||
            (d.originIata === dest && d.destinationIata === orig)),
        );

        if (isDirectActive) {
          // El destino recibe en el color de performance OTP-15 (Esmeralda / Ámbar / Carmesí)
          return d.destinationIata === dest
            ? getOtpColor(d.averageOtp15, 255)
            : isLight
              ? [2, 132, 199, 255]
              : [56, 189, 248, 255];
        }

        if (hasBoth) {
          const baseColor = getOtpColor(d.averageOtp15, 140);
          return [baseColor[0], baseColor[1], baseColor[2], 140];
        }

        if (dest && d.destinationIata === dest) {
          return isLight ? [5, 150, 105, 240] : [16, 185, 129, 240];
        }

        const baseColor = getOtpColor(d.averageOtp15, 220);
        return [baseColor[0], baseColor[1], baseColor[2], 220];
      },
      getWidth: (d: FlightRoute) => {
        if (!hasSelection) return 2.5;
        if (hasBoth) {
          if (
            (d.originIata === orig && d.destinationIata === dest) ||
            (d.originIata === dest && d.destinationIata === orig)
          ) {
            return 8.0; // Grosor elevado para destacar la ruta activa
          }
          return 3.0; // Conexiones secundarias
        }
        return 4.5;
      },
      widthMinPixels: 2.0,
      updateTriggers: {
        getWidth: [orig, dest],
        getSourceColor: [orig, dest, isLight],
        getTargetColor: [orig, dest, isLight],
      },
    }),

    // Capa de Anillo Exterior Sonar / Pulso Táctico para Hubs Activos
    new ScatterplotLayer<Airport>({
      id: "airports-radar-ring-outer",
      data: activeSelectedAirports,
      pickable: false,
      getPosition: (d: Airport) => d.coordinates,
      getRadius: 280000,
      radiusMinPixels: 28,
      radiusMaxPixels: 58,
      stroked: true,
      filled: false,
      getLineColor: (d: Airport) => {
        if (d.iata === orig) {
          return isLight ? [2, 132, 199, 90] : [56, 189, 248, 100];
        }
        return isLight ? [5, 150, 105, 90] : [16, 185, 129, 100];
      },
      lineWidthMinPixels: 1.5,
      lineWidthMaxPixels: 2.5,
      updateTriggers: {
        getLineColor: [orig, dest, isLight],
      },
    }),

    // Capa de Halo Radar / Glow para Hubs Activos (Origen / Destino)
    new ScatterplotLayer<Airport>({
      id: "airports-radar-halo",
      data: activeSelectedAirports,
      pickable: false,
      getPosition: (d: Airport) => d.coordinates,
      getRadius: 160000,
      radiusMinPixels: 18,
      radiusMaxPixels: 38,
      stroked: true,
      filled: true,
      getFillColor: (d: Airport) => {
        if (d.iata === orig) {
          return isLight ? [2, 132, 199, 45] : [56, 189, 248, 45]; // Aero Cyan translúcido
        }
        return isLight ? [5, 150, 105, 45] : [16, 185, 129, 45]; // Esmeralda translúcido
      },
      getLineColor: (d: Airport) => {
        if (d.iata === orig) {
          return isLight ? [2, 132, 199, 200] : [56, 189, 248, 220]; // Stroke de pulso cyan
        }
        return isLight ? [5, 150, 105, 200] : [16, 185, 129, 220]; // Stroke de pulso esmeralda
      },
      lineWidthMinPixels: 2,
      lineWidthMaxPixels: 3.5,
      updateTriggers: {
        getFillColor: [orig, dest, isLight],
        getLineColor: [orig, dest, isLight],
      },
    }),

    // Capa de Nodos de Aeropuertos / Hubs
    new ScatterplotLayer<Airport>({
      id: "airports-nodes",
      data: visibleAirports,
      pickable: true,
      autoHighlight: true,
      highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255],
      getPosition: (d: Airport) => d.coordinates,
      getRadius: (d: Airport) => {
        if (d.iata === orig || d.iata === dest) {
          return 90000;
        }
        return d.type === "large_airport" ? 45000 : 25000;
      },
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      getFillColor: (d: Airport) => {
        if (d.iata === orig) {
          return isLight ? [2, 132, 199, 255] : [56, 189, 248, 255]; // Aero Cyan (Origen)
        }
        if (d.iata === dest) {
          return isLight ? [5, 150, 105, 255] : [16, 185, 129, 255]; // Emerald (Destino)
        }
        return isLight ? [30, 41, 59, 230] : [222, 227, 232, 220];
      },
      getLineColor: (d: Airport) => {
        if (d.iata === orig || d.iata === dest) {
          return [255, 255, 255, 255];
        }
        return isLight ? [255, 255, 255, 255] : [37, 43, 46, 255];
      },
      stroked: true,
      lineWidthMinPixels: 2,
      updateTriggers: {
        getRadius: [orig, dest],
        getFillColor: [orig, dest, isLight],
        getLineColor: [orig, dest, isLight],
      },
    }),

    // Capa de Etiquetas IATA de Aeropuertos en WebGL
    new TextLayer<Airport>({
      id: "airports-labels",
      data: visibleAirports,
      pickable: true,
      getPosition: (d: Airport) => d.coordinates,
      getText: (d: Airport) => d.iata,
      getSize: (d: Airport) => (d.iata === orig || d.iata === dest ? 13 : 11),
      sizeUnits: "pixels",
      sizeMinPixels: 9,
      sizeMaxPixels: 16,
      getColor: (d: Airport) => {
        if (d.iata === orig)
          return isLight ? [2, 132, 199, 255] : [56, 189, 248, 255];
        if (d.iata === dest)
          return isLight ? [5, 150, 105, 255] : [16, 185, 129, 255];
        return isLight ? [15, 23, 42, 230] : [222, 227, 232, 230];
      },
      fontFamily: "JetBrains Mono, monospace, sans-serif",
      fontWeight: "bold",
      getTextAnchor: "middle",
      getAlignmentBaseline: "top",
      getPixelOffset: [0, 14],
      background: true,
      getBackgroundColor: () =>
        isLight ? [255, 255, 255, 180] : [15, 20, 24, 180],
      backgroundPadding: [4, 2, 4, 2],
      updateTriggers: {
        getSize: [orig, dest],
        getColor: [orig, dest, isLight],
        getBackgroundColor: [isLight],
      },
    }),
  ];
}
