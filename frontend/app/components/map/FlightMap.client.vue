<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { MAP_STYLES } from "~/utils/mapUtils";

const mapContainer = ref<HTMLDivElement | null>(null);

const {
  initMap,
  destroyMap,
  mapInstance,
  isLoaded,
  updateLayers,
  fitRoute,
  fitHub,
  setBaseMapStyle,
} = useFlightMap();

const {
  selectedOrigin,
  selectedDestination,
  selectedRouteData,
  activeRouteId,
  mapFitTrigger,
} = useFlightSelection();

const colorMode = useColorMode();

let resizeObserver: ResizeObserver | null = null;

// Suscripciones reactivas centralizadas en el ciclo de vida del mapa
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

watch(
  () => colorMode.value,
  (mode) => {
    const targetStyle = mode === "light" ? MAP_STYLES.light : MAP_STYLES.dark;
    setBaseMapStyle(targetStyle);
  },
);

onMounted(async () => {
  // Esperar a que el DOM esté disponible tras el ciclo de hidratación en el cliente
  await nextTick();

  const containerElement =
    mapContainer.value ||
    (document.getElementById("flywise-map-container") as HTMLDivElement | null);

  if (!containerElement) {
    console.error("[FlyWise FlightMap] Error crítico: no se encontró el contenedor del mapa.");
    return;
  }

  // Inicializar MapLibre GL + Deck.gl con perspectiva aeronáutica inicial
  initMap(containerElement, {
    center: [-30, 20],
    zoom: 2.5,
    pitch: 30,
    bearing: 0,
  });

  // Observador de cambio de dimensiones para redimensionar el canvas WebGL fluidamente
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      mapInstance.value?.resize();
    });
    resizeObserver.observe(containerElement);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  destroyMap();
});
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-background select-none">
    <!-- Contenedor del Canvas MapLibre GL + Deck.gl -->
    <div
      id="flywise-map-container"
      ref="mapContainer"
      class="absolute inset-0 w-full h-full outline-none"
    />

    <!-- Estado de Carga / Radar Scanner Cockpit -->
    <Transition
      enter-active-class="transition-opacity duration-500 ease-out"
      leave-active-class="transition-opacity duration-500 ease-in pointer-events-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!isLoaded"
        class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
      >
        <div class="relative flex items-center justify-center">
          <!-- Anillos pulsantes de radar -->
          <div class="absolute w-28 h-28 rounded-full border border-aero-cyan/20 animate-ping" />
          <div class="absolute w-20 h-20 rounded-full border border-aero-cyan/40 animate-pulse" />
          <div class="w-12 h-12 rounded-full border border-aero-cyan/60 flex items-center justify-center bg-surface-elevated/80 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            <UIcon name="i-lucide-plane" class="w-6 h-6 text-aero-cyan animate-pulse" />
          </div>
        </div>
        <p class="mt-4 font-mono text-xs text-text-muted tracking-widest uppercase">
          Iniciando Telemetría WebGL...
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
:deep(.maplibregl-canvas) {
  outline: none;
}
:deep(.maplibregl-ctrl-bottom-right) {
  display: none !important;
}
:deep(.maplibregl-ctrl-bottom-left) {
  margin: 0 0 12px 16px;
  z-index: 20;
}
:deep(.maplibregl-ctrl-attrib) {
  background-color: var(--hud-panel-bg, rgba(15, 20, 24, 0.75)) !important;
  backdrop-filter: blur(8px);
  border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 10px;
  color: var(--color-text-muted, #94a3b8) !important;
}
:deep(.maplibregl-ctrl-attrib a) {
  color: var(--color-text-main, #cbd5e1) !important;
  text-decoration: none;
}
:deep(.maplibregl-ctrl-attrib a:hover) {
  text-decoration: underline;
}
</style>
