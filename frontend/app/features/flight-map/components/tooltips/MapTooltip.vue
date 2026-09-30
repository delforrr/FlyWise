<script setup lang="ts">
import { computed } from "vue";
import type { FlightRoute } from "~/types/route";
import type { Airport } from "~/types/airport";

const { hoveredEntity } = useFlightSelection();

const isRoute = computed(() => hoveredEntity.value?.type === "route");
const isAirport = computed(() => hoveredEntity.value?.type === "airport");

const routeData = computed<FlightRoute | null>(() => {
  if (isRoute.value && hoveredEntity.value) {
    return hoveredEntity.value.data as FlightRoute;
  }
  return null;
});

const airportData = computed<Airport | null>(() => {
  if (isAirport.value && hoveredEntity.value) {
    return hoveredEntity.value.data as Airport;
  }
  return null;
});

// Telemetría de coordenadas geográficas (LAT / LON)
const telemetryCoordinates = computed<string | null>(() => {
  if (airportData.value?.coordinates && airportData.value.coordinates.length >= 2) {
    const [lon, lat] = airportData.value.coordinates;
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
    return `LAT ${latStr} / LON ${lonStr}`;
  }
  if (routeData.value?.originCoordinates && routeData.value?.destinationCoordinates) {
    const [origLon, origLat] = routeData.value.originCoordinates;
    const [destLon, destLat] = routeData.value.destinationCoordinates;
    const midLat = (origLat + destLat) / 2;
    const midLon = (origLon + destLon) / 2;
    const latStr = `${Math.abs(midLat).toFixed(2)}°${midLat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(midLon).toFixed(2)}°${midLon >= 0 ? "E" : "W"}`;
    return `LAT ${latStr} / LON ${lonStr}`;
  }
  return null;
});

// Parámetros de colisión y márgenes de seguridad para pantalla
const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT = 190;
const CURSOR_OFFSET = 16;
const SCREEN_MARGIN = 12;

// Posicionamiento inteligente con prevención de desborde y clipping en bordes
const tooltipStyle = computed(() => {
  if (!hoveredEntity.value) return { display: "none" };

  const x = hoveredEntity.value.x;
  const y = hoveredEntity.value.y;

  const winWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const winHeight = typeof window !== "undefined" ? window.innerHeight : 768;

  // Eje X: ubicar a la derecha; si colisiona con el borde derecho, invertir a la izquierda
  let targetX = x + CURSOR_OFFSET;
  if (targetX + TOOLTIP_WIDTH > winWidth - SCREEN_MARGIN) {
    targetX = x - TOOLTIP_WIDTH - CURSOR_OFFSET;
  }
  const minX = SCREEN_MARGIN;
  const maxX = Math.max(minX, winWidth - TOOLTIP_WIDTH - SCREEN_MARGIN);
  targetX = Math.min(Math.max(targetX, minX), maxX);

  // Eje Y: ubicar debajo; si colisiona con el borde inferior, invertir hacia arriba
  let targetY = y + CURSOR_OFFSET;
  if (targetY + TOOLTIP_HEIGHT > winHeight - SCREEN_MARGIN) {
    targetY = y - TOOLTIP_HEIGHT - CURSOR_OFFSET;
  }
  const minY = SCREEN_MARGIN;
  const maxY = Math.max(minY, winHeight - TOOLTIP_HEIGHT - SCREEN_MARGIN);
  targetY = Math.min(Math.max(targetY, minY), maxY);

  return {
    transform: `translate3d(${Math.round(targetX)}px, ${Math.round(targetY)}px, 0)`,
  };
});
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    leave-active-class="transition-opacity duration-100 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="hoveredEntity"
      :style="tooltipStyle"
      class="fixed top-0 left-0 z-50 pointer-events-none w-72 p-3 bg-surface-elevated/95 backdrop-blur-xl border border-white/10 dark:border-white/15 shadow-2xl rounded-xl will-change-transform"
    >
      <!-- Telemetría superior con retícula crosshair -->
      <div
        v-if="telemetryCoordinates"
        class="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-white/10 dark:border-white/10 font-mono tabular-nums text-[10px] text-text-dim select-none"
      >
        <div class="flex items-center gap-1.5 text-text-dim/80">
          <UIcon name="i-lucide-crosshair" class="w-3.5 h-3.5 text-primary/80 shrink-0" />
          <span class="tracking-wider uppercase text-[9px] font-semibold">
            {{ isRoute ? 'CORREDOR' : 'TELEMETRÍA' }}
          </span>
        </div>
        <span class="tracking-tight text-text-dim font-medium">
          {{ telemetryCoordinates }}
        </span>
      </div>

      <RouteTooltipContent v-if="routeData" :route="routeData" />
      <AirportTooltipContent v-else-if="airportData" :airport="airportData" />
    </div>
  </Transition>
</template>
