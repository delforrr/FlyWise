<script setup lang="ts">
import { computed } from "vue";
import { useFlightSelection } from "~/composables/useFlightSelection";
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
      <!-- Caso 1: Hover sobre Ruta de Vuelo -->
      <div v-if="routeData" class="flex flex-col gap-2">
        <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
          <div class="flex items-center gap-1.5 font-mono text-sm font-bold text-text-main">
            <span class="text-aero-cyan">{{ routeData.originIata }}</span>
            <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-text-dim" />
            <span class="text-aero-cyan">{{ routeData.destinationIata }}</span>
          </div>
          <span class="font-mono text-[11px] text-text-muted">
            {{ routeData.distanceKm.toLocaleString() }} km
          </span>
        </div>

        <div class="text-xs text-text-muted flex justify-between items-center">
          <span>Aerolínea principal:</span>
          <span class="font-medium text-text-main">{{ routeData.primaryAirline }}</span>
        </div>

        <div class="mt-1 flex items-center justify-between">
          <span class="text-[11px] uppercase tracking-wider text-text-dim font-mono">Puntualidad:</span>
          <HudOtpBadge :value="routeData.averageOtp15" />
        </div>
      </div>

      <!-- Caso 2: Hover sobre Aeropuerto / Hub -->
      <div v-else-if="airportData" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
          <div class="flex items-center gap-1 font-mono font-bold text-base text-aero-cyan">
            <span>{{ airportData.iata }}</span>
            <span v-if="airportData.icao" class="text-xs text-text-dim font-normal">
              ({{ airportData.icao }})
            </span>
          </div>
          <UBadge
            size="xs"
            variant="subtle"
            color="neutral"
            class="font-mono text-[10px]"
          >
            {{ airportData.type === 'large_airport' ? 'HUB' : 'AEROPUERTO' }}
          </UBadge>
        </div>

        <p class="text-xs font-medium text-text-main truncate" :title="airportData.name">
          {{ airportData.name }}
        </p>

        <p class="text-[11px] text-text-muted">
          {{ airportData.city }}, {{ airportData.country }}
        </p>

        <div v-if="airportData.connectionsCount" class="mt-1 pt-1 border-t border-border-subtle/40 flex items-center justify-between text-[11px] font-mono text-text-dim">
          <span>Conexiones directas:</span>
          <span class="text-aero-cyan font-bold">{{ airportData.connectionsCount }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>
