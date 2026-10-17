import { Map, type IControl } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Airport } from "~/types/airport";
import type { FlightRoute } from "~/types/route";
import { SEED_AIRPORTS } from "~/data/seedData";
import { MAP_STYLES } from "../utils/mapUtils";
import { buildFlightMapLayers } from "../utils/mapLayers";
import { useMapPerformance } from "./useMapPerformance";

// Estado del mapa compartido a nivel módulo (Singleton para sincronizar componentes HUD)
const mapInstance = shallowRef<Map | null>(null);
const overlayInstance = shallowRef<MapboxOverlay | null>(null);

const isLoaded = ref<boolean>(false);
const currentPitch = ref<number>(0);
const currentZoom = ref<number>(0);
const currentBearing = ref<number>(0);
let resilienceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Retorna el padding adaptativo de la cámara según el viewport del dispositivo,
 * asegurando que los paneles de interfaz (sidebar lateral en desktop ~424px, drawer inferior en mobile)
 * no ocluyan los arcos de vuelo ni los hubs activos.
 */
function getAdaptivePadding(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  if (typeof window === "undefined") {
    return { top: 100, bottom: 100, left: 100, right: 100 };
  }
  if (window.innerWidth >= 768) {
    return { top: 120, bottom: 90, left: 450, right: 70 };
  }
  return { top: 90, bottom: 330, left: 24, right: 24 };
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
  const performance = useMapPerformance();

  /**
   * Genera las capas activas de WebGL delegando a buildFlightMapLayers (SRP)
   * inyectando las directivas adaptativas de rendimiento (LOD y poda de capas decorativas).
   */
  function buildLayers() {
    return buildFlightMapLayers({
      isLight: colorMode.value === "light",
      selectedOrigin: selectedOrigin.value,
      selectedDestination: selectedDestination.value,
      matchingRoutes: matchingRoutes.value,
      currentZoom: currentZoom.value,
      enableRadarRings: performance.enableRadarRings.value,
      enableLODLabels: performance.enableLODLabels.value,
    });
  }

  /**
   * Refresca las capas en la GPU a través de MapboxOverlay
   */
  function updateLayers(): void {
    if (overlayInstance.value) {
      overlayInstance.value.setProps({
        layers: buildLayers(),
      });
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

    const targetPitch = performance.allow3D.value ? 35 : 0;

    mapInstance.value.fitBounds(bounds, {
      padding: getAdaptivePadding(),
      pitch: targetPitch,
      duration: 1600,
      essential: true,
    });
  }

  /**
   * Cambia el estilo base de Carto (light/dark)
   */
  function setBaseMapStyle(styleUrl: string): void {
    if (!mapInstance.value) return;
    mapInstance.value.setStyle(styleUrl);
  }

  /**
   * Inicializa MapLibre GL inyectándolo en el contenedor DOM provisto y acopla Deck.gl
   * aplicando de forma automática y transparente el perfil de hardware idóneo.
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
      const isMobile = performance.isMobileOrTouch.value;
      const center: [number, number] = options?.center ?? [-30, 20];
      const zoom: number = options?.zoom ?? 2.5;
      // En dispositivos móviles y táctiles, forzar perspectiva 2D plana estricta (pitch: 0)
      const pitch: number = isMobile ? 0 : (options?.pitch ?? 30);
      const bearing: number = options?.bearing ?? 0;

      const activeStyle =
        colorMode.value === "light" ? MAP_STYLES.light : MAP_STYLES.dark;

      // 1. Instanciación de MapLibre GL con optimizaciones de hardware
      const map = new maplibregl.Map({
        container,
        style: activeStyle,
        center,
        zoom,
        pitch,
        bearing,
        minZoom: 1.5,
        maxZoom: 7.5, // Máximo zoom aeronáutico: evita renderizar calles y edificios
        maxPitch: isMobile ? 0 : 60, // En móviles el pitch queda bloqueado en 0°
        dragRotate: !isMobile, // Desactiva rotación accidental en móviles
        touchPitch: !isMobile, // Desactiva inclinación con dos dedos en móviles
        pitchWithRotate: !isMobile,
        pixelRatio: performance.dpr.value, // Clamping dinámico de DPR (1.25 en móvil/low-end)
        maxTileCacheSize: performance.maxTileCache.value, // Control conservador de memoria VRAM/RAM
        attributionControl: { compact: true },
        renderWorldCopies: false,
      });

      mapInstance.value = map;

      // 2. Acoplar MapboxOverlay de Deck.gl
      const deckOverlay = new MapboxOverlay({
        interleaved: false,
        pickingRadius: isMobile ? 12 : 6,
        layers: buildLayers(),
        getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
        onHover: (info) => {
          // En móviles/touch se elimina completamente el listener de picking en hover
          // evitando bloqueos de pipeline en GPU (gl.readPixels) durante el paneo táctil
          if (!performance.enableHoverPicking.value) return;

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
                setOrigin();
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
      map.addControl(deckOverlay as unknown as IControl);

      // 3. Mecanismo para marcar mapa como listo
      const handleReady = () => {
        if (resilienceTimer) {
          clearTimeout(resilienceTimer);
          resilienceTimer = null;
        }
        isLoaded.value = true;
        currentPitch.value = map.getPitch();
        currentZoom.value = map.getZoom();
        currentBearing.value = map.getBearing();
        map.resize();
        updateLayers();
      };

      if (map.loaded()) {
        handleReady();
      } else {
        map.once("load", handleReady);
      }

      // Fallback de seguridad: si tras 800ms el mapa no disparó eventos, forzar isLoaded
      resilienceTimer = setTimeout(() => {
        if (!isLoaded.value && mapInstance.value) {
          console.info(
            "[FlyWise useFlightMap] Fallback de seguridad (800ms) activado: forzando isLoaded.",
          );
          handleReady();
        }
      }, 800);

      map.on("error", (e) => {
        console.warn("[MapLibre Warning]", e);
      });

      map.on("pitch", () => {
        currentPitch.value = map.getPitch();
      });

      let lastZoomCategory = map.getZoom() < 4.0;
      map.on("zoom", () => {
        const z = map.getZoom();
        currentZoom.value = z;
        // Solo refresca capas si cruza el umbral de LOD 4.0 entre vista de mega-hubs y todos los aeropuertos
        if (performance.enableLODLabels.value) {
          const isLowZoom = z < 4.0;
          if (isLowZoom !== lastZoomCategory) {
            lastZoomCategory = isLowZoom;
            updateLayers();
          }
        }
      });

      map.on("rotate", () => {
        currentBearing.value = map.getBearing();
      });
    } catch (err) {
      console.error(
        "[FlyWise useFlightMap] Error al inicializar MapLibre / Deck.gl:",
        err,
      );
    }
  }

  function destroyMap(): void {
    if (resilienceTimer) {
      clearTimeout(resilienceTimer);
      resilienceTimer = null;
    }
    if (mapInstance.value && overlayInstance.value) {
      try {
        mapInstance.value.removeControl(
          overlayInstance.value as unknown as IControl,
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
    currentBearing.value = 0;
  }

  function flyToAirport(
    coords: [number, number] | { lon: number; lat: number },
    zoom: number = 6,
  ): void {
    if (!mapInstance.value) return;

    const [lon, lat] = Array.isArray(coords)
      ? coords
      : [coords.lon, coords.lat];

    const targetPitch = performance.allow3D.value ? 40 : 0;

    mapInstance.value.flyTo({
      center: [lon, lat],
      zoom,
      pitch: targetPitch,
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
      padding?: { top: number; bottom: number; left: number; right: number };
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

    const defaultPitch = performance.allow3D.value ? 35 : 0;

    mapInstance.value.fitBounds(bounds, {
      padding: options?.padding ?? getAdaptivePadding(),
      pitch: options?.pitch ?? defaultPitch,
      duration: options?.duration ?? 1600,
      essential: true,
    });
  }

  function toggle3D(): void {
    if (!mapInstance.value) return;
    // En móviles / touch, 3D está deshabilitado estrictamente
    if (!performance.allow3D.value) return;

    if (currentPitch.value > 0) {
      mapInstance.value.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1000,
      });
    } else {
      mapInstance.value.easeTo({
        pitch: 36,
        bearing: currentBearing.value,
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
    pitch: currentPitch,
    currentZoom,
    zoom: currentZoom,
    currentBearing,
    bearing: currentBearing,
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
