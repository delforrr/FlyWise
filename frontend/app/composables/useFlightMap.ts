import * as maplibregl from "maplibre-gl";
import type { Map, GeoJSONSource } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { SEED_AIRPORTS } from "~/data/seedData";
import { getOtpColor, MAP_STYLES } from "~/utils/mapUtils";

// Estado del mapa compartido a nivel módulo (Singleton para sincronizar componentes HUD)
const mapInstance = shallowRef<Map | null>(null);
const overlayInstance = shallowRef<MapboxOverlay | null>(null);

const isLoaded = ref<boolean>(false);
const currentPitch = ref<number>(0);
const currentZoom = ref<number>(0);

const AIRPORTS_SOURCE_ID = "flywise-airports-source";
const AIRPORTS_LABELS_LAYER_ID = "flywise-airports-labels";

/**
 * Genera el GeoJSON FeatureCollection para las etiquetas de aeropuertos en MapLibre
 */
function getAirportsGeoJSON(airports: Airport[]) {
  return {
    type: "FeatureCollection" as const,
    features: airports.map((a) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: a.coordinates,
      },
      properties: {
        iata: a.iata,
        name: a.name,
        city: a.city,
        type: a.type,
      },
    })),
  };
}

let labelsInteractionsRegistered = false;

/**
 * Registra o sincroniza la capa nativa de símbolos vectoriales en MapLibre GL
 */
function syncMapLibreAirportLabels(
  map: Map,
  airports: Airport[],
  isLight: boolean,
): void {
  if (!map) return;

  const doSync = () => {
    if (!map.isStyleLoaded()) return;

    try {
      const source = map.getSource(AIRPORTS_SOURCE_ID) as GeoJSONSource | undefined;
      const geojson = getAirportsGeoJSON(airports);

      if (!source) {
        map.addSource(AIRPORTS_SOURCE_ID, {
          type: "geojson",
          data: geojson,
        });
      } else {
        source.setData(geojson);
      }

      if (!map.getLayer(AIRPORTS_LABELS_LAYER_ID)) {
        map.addLayer({
          id: AIRPORTS_LABELS_LAYER_ID,
          type: "symbol",
          source: AIRPORTS_SOURCE_ID,
          minzoom: 1.5, // Visible desde zoom global inicial (2.5)
          layout: {
            "text-field": ["get", "iata"],
            "text-font": ["Open Sans Bold", "Noto Sans Regular"],
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2, 9,
              4, 11,
              7, 13,
            ],
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": true, // Evita que Carto oculte las etiquetas
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": isLight ? "#0f172a" : "#dee3e8",
            "text-halo-color": isLight
              ? "rgba(255, 255, 255, 0.95)"
              : "rgba(7, 11, 20, 0.95)",
            "text-halo-width": 2,
          },
        });
      } else {
        map.setPaintProperty(
          AIRPORTS_LABELS_LAYER_ID,
          "text-color",
          isLight ? "#0f172a" : "#dee3e8",
        );
        map.setPaintProperty(
          AIRPORTS_LABELS_LAYER_ID,
          "text-halo-color",
          isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(7, 11, 20, 0.95)",
        );
      }

      // Registrar interacción por clic sobre la etiqueta
      if (!labelsInteractionsRegistered && map.getLayer(AIRPORTS_LABELS_LAYER_ID)) {
        labelsInteractionsRegistered = true;
        map.on("click", AIRPORTS_LABELS_LAYER_ID, (e) => {
          if (e.features && e.features[0]?.properties?.iata) {
            const iata = e.features[0].properties.iata as string;
            const { setOrigin, setDestination, selectedOrigin: curOrig, selectedDestination: curDest } = useFlightSelection();
            if (!curOrig.value) {
              setOrigin(iata);
            } else if (curOrig.value === iata) {
              setOrigin(undefined);
            } else if (!curDest.value) {
              setDestination(iata);
            } else {
              setOrigin(iata);
            }
          }
        });

        map.on("mouseenter", AIRPORTS_LABELS_LAYER_ID, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", AIRPORTS_LABELS_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    } catch (err) {
      console.warn("[FlyWise] Error en syncMapLibreAirportLabels:", err);
    }
  };

  if (map.isStyleLoaded()) {
    doSync();
  } else {
    // Escuchar styledata hasta que el estilo esté completamente cargado
    const onStyleData = () => {
      if (map.isStyleLoaded()) {
        map.off("styledata", onStyleData);
        doSync();
      }
    };
    map.on("styledata", onStyleData);
  }
}

export const useFlightMap = () => {
  const {
    setHoveredEntity,
    clearHoveredEntity,
    setRoute,
    setOrigin,
    setDestination,
    selectedRouteData,
    selectedOrigin,
    selectedDestination,
    matchingRoutes,
  } = useFlightSelection();

  const colorMode = useColorMode();

  /**
   * Determina los aeropuertos visibles según el estado de selección
   */
  function getVisibleAirports(
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
   * Genera las capas activas de WebGL (ArcLayer y ScatterplotLayer).
   * REGLA: El mapa inicia sin arcos hasta que se selecciona un aeropuerto o ruta.
   */
  function buildLayers() {
    const isLight = colorMode.value === "light";
    const orig = selectedOrigin.value;
    const dest = selectedDestination.value;
    const hasSelection = Boolean(orig || dest);
    const hasBoth = Boolean(orig && dest);

    // 1. Filtrar rutas: Sin selección activa NO se renderiza ningún arco
    const visibleRoutes = hasSelection ? matchingRoutes.value : [];

    // 2. Aeropuertos visibles (despejar pantalla si hay selección, o todos si está en vista general)
    const visibleAirports = getVisibleAirports(hasSelection, orig, dest, visibleRoutes);

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
          return 4.5;
        },
        widthMinPixels: 1.5,
        updateTriggers: {
          getWidth: [orig, dest],
          getSourceColor: [isLight],
          getTargetColor: [isLight],
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
        updateTriggers: {
          getRadius: [orig, dest],
          getFillColor: [orig, dest, isLight],
          getLineColor: [orig, dest, isLight],
        },
      }),
    ];
  }

  /**
   * Refresca las capas en la GPU a través de MapboxOverlay y sincroniza etiquetas nativas MapLibre
   */
  function updateLayers(): void {
    if (overlayInstance.value) {
      overlayInstance.value.setProps({
        layers: buildLayers(),
      });
    }

    if (mapInstance.value && mapInstance.value.isStyleLoaded()) {
      const orig = selectedOrigin.value;
      const dest = selectedDestination.value;
      const hasSelection = Boolean(orig || dest);
      const visibleRoutes = hasSelection ? matchingRoutes.value : [];
      const visibleAirports = getVisibleAirports(hasSelection, orig, dest, visibleRoutes);
      const isLight = colorMode.value === "light";

      syncMapLibreAirportLabels(mapInstance.value, visibleAirports, isLight);
    }
  }

  /**
   * Encuadra la cámara suavemente alrededor de un Hub y todas sus conexiones
   */
  function fitHub(airportIata: string): void {
    if (!mapInstance.value) return;
    const airport = SEED_AIRPORTS.find((a) => a.iata === airportIata);
    if (!airport) return;

    const connectedRoutes = matchingRoutes.value.filter(
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
    for (const r of connectedRoutes) {
      bounds.extend(r.originCoordinates);
      bounds.extend(r.destinationCoordinates);
    }

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

  /**
   * Cambia el estilo base de Carto (light/dark) de forma resiliente
   */
  function setBaseMapStyle(styleUrl: string): void {
    if (!mapInstance.value) return;
    const map = mapInstance.value;
    labelsInteractionsRegistered = false;
    map.setStyle(styleUrl);
  }

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
        minZoom: 1.5,
        maxZoom: 7.5, // Máximo zoom aeronáutico: evita renderizar calles y edificios
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });

      mapInstance.value = map;

      // Interacción directa por clic sobre las etiquetas IATA de MapLibre
      map.on("click", AIRPORTS_LABELS_LAYER_ID, (e) => {
        if (e.features && e.features[0]?.properties?.iata) {
          const iata = e.features[0].properties.iata as string;
          if (!selectedOrigin.value) {
            setOrigin(iata);
          } else if (selectedOrigin.value === iata) {
            setOrigin(null);
          } else if (!selectedDestination.value) {
            setDestination(iata);
          } else {
            setOrigin(iata);
          }
        }
      });

      map.on("mouseenter", AIRPORTS_LABELS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", AIRPORTS_LABELS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

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
                setOrigin(undefined);
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

      // 3. Mecanismo para marcar mapa como listo y registrar capas nativas
      const handleStyleOrReady = () => {
        isLoaded.value = true;
        currentPitch.value = map.getPitch();
        currentZoom.value = map.getZoom();
        updateLayers();
      };

      if (map.loaded() && map.isStyleLoaded()) {
        handleStyleOrReady();
      } else {
        map.once("load", handleStyleOrReady);
      }

      map.on("styledata", () => {
        if (map.isStyleLoaded()) {
          handleStyleOrReady();
        }
      });

      map.on("error", (e) => {
        console.warn("[MapLibre Warning]", e);
      });

      map.on("pitch", () => {
        currentPitch.value = map.getPitch();
      });

      map.on("zoom", () => {
        currentZoom.value = map.getZoom();
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
    labelsInteractionsRegistered = false;
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
    updateLayers,
    setBaseMapStyle,
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
