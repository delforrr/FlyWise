<script setup lang="ts">
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

// Posicionamiento inteligente para evitar desbordar bordes de pantalla
const tooltipStyle = computed(() => {
  if (!hoveredEntity.value) return { display: "none" };

  const x = hoveredEntity.value.x;
  const y = hoveredEntity.value.y;

  // Si está muy cerca del borde derecho o inferior, invertir desplazamiento
  const offsetX = x > (typeof window !== "undefined" ? window.innerWidth - 280 : 800) ? -270 : 16;
  const offsetY = y > (typeof window !== "undefined" ? window.innerHeight - 200 : 600) ? -160 : 16;

  return {
    transform: `translate3d(${x + offsetX}px, ${y + offsetY}px, 0)`,
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
      class="fixed top-0 left-0 z-50 pointer-events-none w-64 p-3 hud-card shadow-2xl border border-border-subtle/80 bg-surface-elevated/95 backdrop-blur-xl rounded-xl"
    >
      <RouteTooltipContent v-if="routeData" :route="routeData" />
      <AirportTooltipContent v-else-if="airportData" :airport="airportData" />
    </div>
  </Transition>
</template>
