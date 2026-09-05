<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useFlightMap } from "~/composables/useFlightMap";

const mapContainer = ref<HTMLDivElement | null>(null);
const { initMap, destroyMap, mapInstance, isLoaded } = useFlightMap();

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!mapContainer.value) return;

  // Inicializar MapLibre GL + Deck.gl con perspectiva aeronáutica inicial
  initMap(mapContainer.value, {
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
    resizeObserver.observe(mapContainer.value);
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
:deep(.maplibregl-ctrl-bottom-left),
:deep(.maplibregl-ctrl-bottom-right) {
  display: none !important; /* Ocultar controles nativos para usar HUD personalizado */
}
</style>
