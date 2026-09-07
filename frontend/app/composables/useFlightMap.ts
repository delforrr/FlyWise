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
    selectedRouteData,
    activeRouteId,
  } = useFlightSelection();

  function getOtpColor(otp15: number): [number, number, number, number] {
    if (otp15 >= 85) return [16, 185, 129, 210]; // 🟢 OTP-Good (Emerald)
    if (otp15 >= 60) return [245, 158, 11, 210]; // 🟡 OTP-Warning (Amber)
    return [239, 68, 68, 210]; // 🔴 OTP-Critical (Crimson)
  }

  const colorMode = useColorMode();

  const MAP_STYLES = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  } as const;

  /**
   * Genera las capas activas de WebGL (ArcLayer, ScatterplotLayer, TextLayer).
   */
  function buildLayers() {
    const activeId = activeRouteId.value;
    const isLight = colorMode.value === "light";

    return [
      // 1. Capa de Arcos Geodésicos 3D (Rutas y puntualidad OTP-15)
      new ArcLayer<FlightRoute>({
        id: "flight-routes-arc",
        data: SEED_ROUTES,
        pickable: true,
        autoHighlight: true,
        highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255], // Aero Cyan
        greatCircle: true,
        getSourcePosition: (d: FlightRoute) => d.originCoordinates,
        getTargetPosition: (d: FlightRoute) => d.destinationCoordinates,
        getSourceColor: (d: FlightRoute) => getOtpColor(d.averageOtp15),
        getTargetColor: (d: FlightRoute) => getOtpColor(d.averageOtp15),
        getWidth: (d: FlightRoute) => (d.id === activeId ? 5 : 2.5),
        widthMinPixels: 2.5,
      }),

      // 2. Capa de Nodos de Aeropuertos / Hubs
      new ScatterplotLayer<Airport>({
        id: "airports-nodes",
        data: SEED_AIRPORTS,
        pickable: true,
        autoHighlight: true,
        highlightColor: isLight ? [2, 132, 199, 255] : [56, 189, 248, 255],
        getPosition: (d: Airport) => d.coordinates,
        getRadius: (d: Airport) => (d.type === "large_airport" ? 45000 : 25000),
        radiusMinPixels: 4,
        radiusMaxPixels: 12,
        getFillColor: isLight ? [30, 41, 59, 230] : [222, 227, 232, 220],
        getLineColor: isLight ? [255, 255, 255, 255] : [37, 43, 46, 255],
        stroked: true,
        lineWidthMinPixels: 1.5,
      }),

      // 3. Capa de Etiquetas IATA (Visible con zoom moderado)
      new TextLayer<Airport>({
        id: "airports-labels",
        data: SEED_AIRPORTS,
        pickable: false,
        getPosition: (d: Airport) => d.coordinates,
        getText: (d: Airport) => d.iata,
        getSize: 11,
        getColor: isLight ? [15, 23, 42, 240] : [222, 227, 232, 240],
        getTextAnchor: "middle",
        getAlignmentBaseline: "top",
        getPixelOffset: [0, 8],
        fontFamily: "JetBrains Mono, monospace",
        fontWeight: 700,
        visible: currentZoom.value >= 3.5,
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

  // Vigilar cambios en la ruta seleccionada para actualizar grosor y resaltado
  watch(activeRouteId, () => {
    updateLayers();
  });

  watch(selectedRouteData, (route) => {
    updateLayers();
    if (route) {
      fitRoute(route.originCoordinates, route.destinationCoordinates);
    }
  });

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
   *
   * @param container Elemento HTML del DOM o selector CSS donde se monta el canvas.
   * @param options Configuración inicial de cámara (centro, zoom, inclinación, rumbo).
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
    // Evitar duplicación si ya está inicializado o no hay contenedor
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

      // 2. Acoplar MapboxOverlay de Deck.gl de forma inmediata en modo overlay
      const deckOverlay = new MapboxOverlay({
        interleaved: false,
        pickingRadius: 10,
        layers: buildLayers(),
        getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
        onHover: (info) => {
          if (info && info.object) {
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
          if (info && info.object) {
            if ("originIata" in (info.object as object)) {
              const route = info.object as FlightRoute;
              setRoute(route.originIata, route.destinationIata);
            } else if ("iata" in (info.object as object)) {
              const airport = info.object as Airport;
              setOrigin(airport);
            }
          }
        },
      });

      overlayInstance.value = deckOverlay;
      map.addControl(deckOverlay as unknown as maplibregl.IControl);

      // 3. Mecanismo resiliente para marcar el mapa como listo (isLoaded)
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

      // Fallbacks en caso de que Carto CDN demore en responder fuentes o sprites
      map.once("idle", setMapReady);
      map.on("styledata", () => {
        if (map.isStyleLoaded()) {
          setMapReady();
        }
      });

      // Timeout de seguridad: Si las teselas ya renderizan pero la red es lenta, no bloquear la interfaz
      setTimeout(setMapReady, 1200);

      map.on("error", (e) => {
        console.warn("[MapLibre Warning]", e);
      });

      // 4. Sincronización continua de la cámara
      map.on("pitch", () => {
        currentPitch.value = map.getPitch();
      });

      map.on("zoom", () => {
        currentZoom.value = map.getZoom();
        updateLayers(); // Actualizar visibilidad de etiquetas según nivel de zoom
      });
    } catch (err) {
      console.error(
        "[FlyWise useFlightMap] Error al inicializar MapLibre / Deck.gl:",
        err,
      );
    }
  }

  /**
   * Destruye de forma segura el mapa y libera recursos WebGL de la GPU.
   */
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
  // Nota: destroyMap() debe ser invocado por el componente host del mapa (ej. FlightMap.client.vue)
  // en su propio onUnmounted, para no destruir la instancia si un botón HUD se desmonta.

  /**
   * Desplaza la cámara de forma cinemática y fluida hacia un aeropuerto.
   *
   * @param coords Coordenadas en formato tupla [longitud, latitud] u objeto { lon, lat }.
   * @param zoom Nivel de zoom objetivo (por defecto 6 para vista metropolitana).
   */
  function flyToAirport(
    coords: [number, number] | { lon: number; lat: number },
    zoom: number = 6,
  ): void {
    if (!mapInstance.value) return;

    // Normalizar coordenadas
    const [lon, lat] = Array.isArray(coords)
      ? coords
      : [coords.lon, coords.lat];

    mapInstance.value.flyTo({
      center: [lon, lat],
      zoom,
      pitch: 40, // Inclinación cinemática suave para apreciar la altitud
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  }

  /**
   * Encuadra la cámara suavemente sobre la ruta provista o sobre la ruta activa actual.
   *
   * @param originCoords Coordenadas de salida opcionales [longitud, latitud].
   * @param destinationCoords Coordenadas de llegada opcionales [longitud, latitud].
   * @param options Opciones de encuadre (padding personalizado, pitch, etc.).
   */
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
      }
    }

    if (!orig || !dest) return;

    const bounds = new maplibregl.LngLatBounds(orig, orig);
    bounds.extend(dest);

    mapInstance.value.fitBounds(bounds, {
      padding: {
        top: 140, // Espacio para Header y barra de búsqueda flotante
        bottom: 90, // Espacio para la leyenda de puntualidad OTP-15
        left: 60,
        right: 60,
      },
      pitch: options?.pitch ?? 35, // Inclinación suave
      duration: options?.duration ?? 1800, // 1.8 segundos
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
    toggle3D,
    resetNorth,
    zoomIn,
    zoomOut,
  };
};

export default useFlightMap;
