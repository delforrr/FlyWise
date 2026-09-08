import * as maplibregl from "maplibre-gl";
import type { Map } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { SEED_AIRPORTS, SEED_ROUTES } from "~/data/seedData";

// Estado del mapa compartido a nivel módulo (Singleton para sincronizar componentes HUD)
const mapInstance = shallowRef<Map | null>(null);
const overlayInstance = shallowRef<MapboxOverlay | null>(null);

const isLoaded = ref<boolean>(false);
const currentPitch = ref<number>(0);
const currentZoom = ref<number>(0);

export const useFlightMap = () => {
  const {
    setHoveredEntity,
    clearHoveredEntity,
    setRoute,
    setOrigin,
    setDestination,
    selectedRouteData,
    activeRouteId,
    selectedOrigin,
    selectedDestination,
    isRouteMatched,
    mapFitTrigger,
  } = useFlightSelection();

  const colorMode = useColorMode();

  /**
   * Genera las capas activas de WebGL (ArcLayer, ScatterplotLayer, TextLayer).
   */
  function buildLayers() {
    const isLight = colorMode.value === "light";
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;
    const hasSelection = Boolean(orig || dest);
    const hasBoth = Boolean(orig && dest);

    // 1. Filtrar rutas: cuando hay selección activa, las no relacionadas DESAPARECEN por completo
    const visibleRoutes = hasSelection
      ? SEED_ROUTES.filter((d) => isRouteMatched(d))
      : SEED_ROUTES;

    // 2. Aeropuertos conectados a las rutas visibles para despejar la pantalla
    const activeAirportIatas = new Set<string>();
    if (hasSelection) {
      if (orig) activeAirportIatas.add(orig);
      if (dest) activeAirportIatas.add(dest);
      visibleRoutes.forEach((r) => {
        activeAirportIatas.add(r.originIata);
        activeAirportIatas.add(r.destinationIata);
      });
    }

    const visibleAirports = hasSelection
      ? SEED_AIRPORTS.filter((a) => activeAirportIatas.has(a.iata))
      : SEED_AIRPORTS;

    return [
      // 1. Capa de Arcos Geodésicos 3D (Rutas y puntualidad OTP-15)
      new ArcLayer<FlightRoute>({
        id: "flight-routes-arc",
        data: visibleRoutes,
        pickable: true,
        autoHighlight: true,
        highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255], // Aero Cyan
        greatCircle: true,
        getSourcePosition: (d: FlightRoute) => d.originCoordinates,
        getTargetPosition: (d: FlightRoute) => d.destinationCoordinates,
        getSourceColor: (d: FlightRoute) => {
          const baseColor = getOtpColor(d.averageOtp15);
          return [baseColor[0], baseColor[1], baseColor[2], 255];
        },
        getTargetColor: (d: FlightRoute) => {
          const baseColor = getOtpColor(d.averageOtp15);
          return [baseColor[0], baseColor[1], baseColor[2], 255];
        },
        getWidth: (d: FlightRoute) => {
          if (!hasSelection) return 2.5;
          if (hasBoth) {
            if (
              (d.originIata === orig && d.destinationIata === dest) ||
              (d.originIata === dest && d.destinationIata === orig)
            ) {
              return 6.5;
            }
            return 3.5;
          }
          // Si solo hay origen o destino seleccionado (visión de Hub multiruta)
          return 4.5;
        },
        widthMinPixels: 1.5,
      }),

      // 2. Capa de Nodos de Aeropuertos / Hubs
      new ScatterplotLayer<Airport>({
        id: "airports-nodes",
        data: visibleAirports,
        pickable: true,
        autoHighlight: true,
        highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255],
        getPosition: (d: Airport) => d.coordinates,
        getRadius: (d: Airport) => {
          if (d.iata === orig || d.iata === dest) {
            return 80000;
          }
          return d.type === "large_airport" ? 45000 : 25000;
        },
        radiusMinPixels: 4,
        radiusMaxPixels: 16,
        getFillColor: (d: Airport) => {
          if (d.iata === orig) {
            return [56, 189, 248, 255]; // Aero Cyan (Origen)
          }
          if (d.iata === dest) {
            return [16, 185, 129, 255]; // Emerald (Destino)
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
        lineWidthMinPixels: 1.5,
      }),

      // 3. Capa de Etiquetas IATA (Visible con zoom moderado o si está seleccionado)
      new TextLayer<Airport>({
        id: "airports-labels",
        data: visibleAirports,
        pickable: false,
        getPosition: (d: Airport) => d.coordinates,
        getText: (d: Airport) => d.iata,
        getSize: (d: Airport) => (d.iata === orig || d.iata === dest ? 14 : 11),
        getColor: (d: Airport) => {
          if (d.iata === orig) return [56, 189, 248, 255];
          if (d.iata === dest) return [16, 185, 129, 255];
          return isLight ? [15, 23, 42, 240] : [222, 227, 232, 240];
        },
        getTextAnchor: "middle",
        getAlignmentBaseline: "top",
        getPixelOffset: [0, 8],
        fontFamily: "JetBrains Mono, monospace",
        fontWeight: 700,
        visible: currentZoom.value >= 3.0 || Boolean(orig || dest),
      }),
    ];
  }

  /**
   * Refresca las capas en la GPU a través de MapboxOverlay.
   */
  function updateLayers(): void {
    if (!overlayInstance.value) return;
    overlayInstance.value.setProps({
      layers: buildLayers(),
    });
  }

  /**
   * Encuadra la cámara suavemente alrededor de un Hub y todas sus conexiones
   */
  function fitHub(airportIata: string): void {
    if (!mapInstance.value) return;
    const airport = SEED_AIRPORTS.find((a) => a.iata === airportIata);
    if (!airport) return;

    const connectedRoutes = SEED_ROUTES.filter(
      (r) => r.originIata === airportIata || r.destinationIata === airportIata,
    );

    if (connectedRoutes.length === 0) {
      flyToAirport(airport.coordinates, 5);
      return;
    }

    const bounds = new maplibregl.LngLatBounds(
      airport.coordinates,
      airport.coordinates,
    );
    connectedRoutes.forEach((r) => {
      bounds.extend(r.originCoordinates);
      bounds.extend(r.destinationCoordinates);
    });

    mapInstance.value.fitBounds(bounds, {
      padding: {
        top: 150,
        bottom: 120,
        left: 80,
        right: 80,
      },
      pitch: 32,
      duration: 1800,
      essential: true,
    });
  }

  // Vigilar cambios en la selección de origen y destino
  watch(selectedOrigin, (newOrigin) => {
    updateLayers();
    if (newOrigin && !selectedDestination.value) {
      fitHub(newOrigin);
    } else if (newOrigin && selectedDestination.value) {
      fitRoute();
    }
  });

  watch(selectedDestination, (newDest) => {
    updateLayers();
    if (newDest && !selectedOrigin.value) {
      fitHub(newDest);
    } else if (newDest && selectedOrigin.value) {
      fitRoute();
    }
  });

  watch(activeRouteId, () => {
    updateLayers();
  });

  watch(selectedRouteData, (route) => {
    updateLayers();
    if (route) {
      fitRoute(route.originCoordinates, route.destinationCoordinates);
    }
  });

  // Vigilar solicitudes explícitas de encuadre HUD
  watch(mapFitTrigger, () => {
    if (selectedOrigin.value && selectedDestination.value) {
      fitRoute();
    } else if (selectedOrigin.value) {
      fitHub(selectedOrigin.value);
    } else if (selectedDestination.value) {
      fitHub(selectedDestination.value);
    } else if (mapInstance.value) {
      mapInstance.value.flyTo({
        center: [-30, 20],
        zoom: 2.5,
        pitch: 30,
        bearing: 0,
        duration: 1200,
      });
    }
  });

  // Si se limpia la selección completa, volver suavemente a la perspectiva global
  watch(
    () => [selectedOrigin.value, selectedDestination.value],
    ([orig, dest]) => {
      if (!orig && !dest && mapInstance.value) {
        mapInstance.value.flyTo({
          center: [-30, 20],
          zoom: 2.5,
          pitch: 30,
          bearing: 0,
          duration: 1200,
        });
      }
    },
  );

  // Vigilar cambios de tema (claro/oscuro) para actualizar el mapa base y capas
  watch(
    () => colorMode.value,
    (mode) => {
      if (!mapInstance.value) return;
      const targetStyle = mode === "light" ? MAP_STYLES.light : MAP_STYLES.dark;
      mapInstance.value.setStyle(targetStyle);
      updateLayers();
    },
  );

  /**
   * Inicializa MapLibre GL inyectándolo en el contenedor DOM provisto y acopla Deck.gl.
   */
  function initMap(
    container: HTMLElement | string,
    options?: {
      center?: [number, number];
      zoom?: number;
      pitch?: number;
      bearing?: number;
    },
  ): void {
    if (!container || mapInstance.value) return;

    try {
      const center: [number, number] = options?.center ?? [-30, 20];
      const zoom: number = options?.zoom ?? 2.5;
      const pitch: number = options?.pitch ?? 30;
      const bearing: number = options?.bearing ?? 0;

      const activeStyle =
        colorMode.value === "light" ? MAP_STYLES.light : MAP_STYLES.dark;

      // 1. Instanciación de MapLibre GL
      const map = new maplibregl.Map({
        container,
        style: activeStyle,
        center,
        zoom,
        pitch,
        bearing,
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });

      mapInstance.value = map;

      // 2. Acoplar MapboxOverlay de Deck.gl
      const deckOverlay = new MapboxOverlay({
        interleaved: false,
        pickingRadius: 10,
        layers: buildLayers(),
        getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
        onHover: (info) => {
          if (info?.object) {
            const isRoute = "originIata" in (info.object as object);
            setHoveredEntity({
              type: isRoute ? "route" : "airport",
              data: info.object as FlightRoute | Airport,
              x: Math.round(info.x),
              y: Math.round(info.y),
            });
          } else {
            clearHoveredEntity();
          }
        },
        onClick: (info) => {
          if (info?.object) {
            if ("originIata" in (info.object as object)) {
              const route = info.object as FlightRoute;
              setRoute(route.originIata, route.destinationIata);
            } else if ("iata" in (info.object as object)) {
              const airport = info.object as Airport;
              if (!selectedOrigin.value) {
                setOrigin(airport.iata);
              } else if (selectedOrigin.value === airport.iata) {
                setOrigin(null);
              } else if (!selectedDestination.value) {
                setDestination(airport.iata);
              } else {
                setOrigin(airport.iata);
              }
            }
          }
        },
      });

      overlayInstance.value = deckOverlay;
      map.addControl(deckOverlay as unknown as maplibregl.IControl);

      // 3. Mecanismo para marcar mapa como listo
      const setMapReady = () => {
        if (isLoaded.value) return;
        isLoaded.value = true;
        currentPitch.value = map.getPitch();
        currentZoom.value = map.getZoom();
        updateLayers();
      };

      if (map.loaded()) {
        setMapReady();
      } else {
        map.once("load", setMapReady);
      }

      map.once("idle", setMapReady);
      map.on("styledata", () => {
        if (map.isStyleLoaded()) {
          setMapReady();
        }
      });

      setTimeout(setMapReady, 1200);

      map.on("error", (e) => {
        console.warn("[MapLibre Warning]", e);
      });

      map.on("pitch", () => {
        currentPitch.value = map.getPitch();
      });

      map.on("zoom", () => {
        currentZoom.value = map.getZoom();
        updateLayers();
      });
    } catch (err) {
      console.error(
        "[FlyWise useFlightMap] Error al inicializar MapLibre / Deck.gl:",
        err,
      );
    }
  }

  function destroyMap(): void {
    if (mapInstance.value && overlayInstance.value) {
      try {
        mapInstance.value.removeControl(
          overlayInstance.value as unknown as maplibregl.IControl,
        );
      } catch {
        overlayInstance.value.finalize();
      }
      overlayInstance.value = null;
    } else if (overlayInstance.value) {
      overlayInstance.value.finalize();
      overlayInstance.value = null;
    }

    if (mapInstance.value) {
      mapInstance.value.remove();
      mapInstance.value = null;
    }
    isLoaded.value = false;
    currentPitch.value = 0;
    currentZoom.value = 0;
  }

  function flyToAirport(
    coords: [number, number] | { lon: number; lat: number },
    zoom: number = 6,
  ): void {
    if (!mapInstance.value) return;

    const [lon, lat] = Array.isArray(coords)
      ? coords
      : [coords.lon, coords.lat];

    mapInstance.value.flyTo({
      center: [lon, lat],
      zoom,
      pitch: 40,
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  }

  function fitRoute(
    originCoords?: [number, number],
    destinationCoords?: [number, number],
    options?: {
      pitch?: number;
      duration?: number;
    },
  ): void {
    if (!mapInstance.value) return;

    let orig = originCoords;
    let dest = destinationCoords;

    if (!orig || !dest) {
      if (selectedRouteData.value) {
        orig = selectedRouteData.value.originCoordinates;
        dest = selectedRouteData.value.destinationCoordinates;
      } else if (selectedOrigin.value) {
        fitHub(selectedOrigin.value);
        return;
      } else if (selectedDestination.value) {
        fitHub(selectedDestination.value);
        return;
      }
    }

    if (!orig || !dest) return;

    const bounds = new maplibregl.LngLatBounds(orig, orig);
    bounds.extend(dest);

    mapInstance.value.fitBounds(bounds, {
      padding: {
        top: 140,
        bottom: 90,
        left: 60,
        right: 60,
      },
      pitch: options?.pitch ?? 35,
      duration: options?.duration ?? 1800,
      essential: true,
    });
  }

  function toggle3D(): void {
    if (!mapInstance.value) return;

    if (currentPitch.value > 0) {
      mapInstance.value.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } else {
      mapInstance.value.easeTo({
        pitch: 60,
        bearing: 45,
        duration: 1000,
      });
    }
  }

  function resetNorth(): void {
    if (!mapInstance.value) return;

    mapInstance.value.easeTo({
      bearing: 0,
      duration: 1000,
    });
  }

  function zoomIn(): void {
    mapInstance.value?.zoomIn({
      duration: 400,
    });
  }

  function zoomOut(): void {
    mapInstance.value?.zoomOut({
      duration: 400,
    });
  }

  return {
    mapInstance,
    overlayInstance,
    isLoaded,
    currentPitch,
    currentZoom,
    initMap,
    destroyMap,
    flyToAirport,
    fitRoute,
    fitHub,
    toggle3D,
    resetNorth,
    zoomIn,
    zoomOut,
  };
};

export default useFlightMap;
