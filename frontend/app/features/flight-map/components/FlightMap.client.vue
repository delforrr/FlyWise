<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { MAP_STYLES } from "../utils/mapUtils";

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
let resizeRafId: number | null = null;
let initRafId: number | null = null;

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
    updateLayers();
  },
);

onMounted(async () => {
  // Esperar a que el DOM esté disponible tras el ciclo de hidratación en el cliente
  await nextTick();

  const containerElement =
    mapContainer.value ||
    (document.getElementById("flywise-map-container") as HTMLDivElement | null);

  if (!containerElement) {
    console.error(
      "[FlyWise FlightMap] Error crítico: no se encontró el contenedor del mapa.",
    );
    return;
  }

  // Inicializar MapLibre GL + Deck.gl con perspectiva aeronáutica inicial
  initMap(containerElement, {
    center: [-30, 20],
    zoom: 2.5,
    pitch: 30,
    bearing: 0,
  });

  // Redimensionar el canvas inmediatamente para asegurar ajuste a las dimensiones reales
  mapInstance.value?.resize();
  initRafId = requestAnimationFrame(() => {
    initRafId = null;
    mapInstance.value?.resize();
  });

  // Observador de cambio de dimensiones para redimensionar el canvas WebGL fluidamente
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRafId !== null) return;
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        mapInstance.value?.resize();
      });
    });
    resizeObserver.observe(containerElement);
  }
});

onUnmounted(() => {
  if (initRafId !== null) {
    cancelAnimationFrame(initRafId);
    initRafId = null;
  }
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId);
    resizeRafId = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
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

    <!-- Estado de Carga / Radar Scanner Cockpit Táctico -->
    <Transition
      enter-active-class="transition-opacity duration-500 ease-out"
      leave-active-class="transition-opacity duration-500 ease-in pointer-events-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!isLoaded"
        class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md"
      >
        <!-- Scanner Radar Circular -->
        <div class="relative flex items-center justify-center">
          <!-- Aro Perimetral y Contenedor del Radar -->
          <div
            class="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-primary/30 flex items-center justify-center overflow-hidden bg-surface-elevated/40 shadow-[0_0_35px_rgba(56,189,248,0.15)]"
          >
            <!-- Ejes de Coordenadas Tácticos (Crosshairs) -->
            <div
              class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary/20 pointer-events-none"
            />
            <div
              class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary/20 pointer-events-none"
            />

            <!-- Anillos Concéntricos de Rango -->
            <div
              class="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-dashed border-primary/25 pointer-events-none"
            />
            <div
              class="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-primary/35 pointer-events-none"
            />

            <!-- Haz de Barrido Radar 360° con Rayo Guía (Sweep Beam) -->
            <div
              class="absolute inset-0 rounded-full radar-sweep-beam pointer-events-none"
            >
              <div
                class="absolute top-0 right-1/2 w-0.5 h-1/2 bg-gradient-to-t from-primary to-transparent origin-bottom shadow-[0_0_8px_rgba(56,189,248,0.8)]"
              />
            </div>

            <!-- Blips Tácticos Detectados -->
            <div
              class="absolute top-7 right-10 w-2 h-2 rounded-full bg-primary/80 animate-ping pointer-events-none"
            />
            <div
              class="absolute top-7 right-10 w-2 h-2 rounded-full bg-primary pointer-events-none"
            />
            <div
              class="absolute bottom-10 left-8 w-1.5 h-1.5 rounded-full bg-emerald-400/90 animate-pulse pointer-events-none"
            />

            <!-- Centro del Hub / Avionics Core -->
            <div
              class="relative z-10 w-11 h-11 rounded-full border border-primary/70 bg-surface-elevated/95 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]"
            >
              <UIcon
                name="i-lucide-plane"
                class="w-5 h-5 text-primary animate-pulse"
              />
            </div>
          </div>
        </div>

        <!-- Telemetría y Estado de Carga -->
        <div class="mt-6 flex flex-col items-center gap-1.5 text-center">
          <div class="flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
              />
              <span
                class="relative inline-flex rounded-full h-2 w-2 bg-primary"
              />
            </span>
            <span
              class="font-mono text-xs font-semibold text-text-main tracking-widest uppercase"
            >
              FlyWise - Explorador Global
            </span>
          </div>
          <span
            class="font-mono text-[11px] text-text-muted tracking-wider uppercase"
          >
            Cargando mapa interactivo, esto puede tomar tiempo...
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
#flywise-map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@keyframes radar-sweep {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.radar-sweep-beam {
  animation: radar-sweep 2.8s linear infinite;
  background: conic-gradient(
    from 0deg,
    rgba(56, 189, 248, 0.4) 0deg,
    rgba(56, 189, 248, 0.12) 35deg,
    transparent 70deg,
    transparent 360deg
  );
}

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
