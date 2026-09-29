<script setup lang="ts">
import { computed } from "vue";
import type { Airport } from "~/types/airport";

const props = defineProps<{
  airport: Airport;
}>();

// Distinción de categoría aeronáutica
const categoryBadge = computed(() => {
  switch (props.airport.type) {
    case "large_airport":
      return {
        label: "HUB INTERNACIONAL",
        color: "primary" as const,
      };
    case "medium_airport":
      return {
        label: "REGIONAL",
        color: "neutral" as const,
      };
    case "small_airport":
    default:
      return {
        label: "AEROPUERTO",
        color: "neutral" as const,
      };
  }
});

// Coordenadas geográficas estándar SRID 4326 (WGS 84): [lon, lat]
const formattedCoordinates = computed<string>(() => {
  if (!props.airport.coordinates || props.airport.coordinates.length < 2) return "--";
  const [lon, lat] = props.airport.coordinates;
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lonStr}`;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Header: Código IATA, Código OACI y Badge de Categoría -->
    <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5 gap-2">
      <div class="flex items-baseline gap-1.5 font-mono">
        <span class="text-base font-bold text-primary tracking-tight">{{ airport.iata }}</span>
        <span v-if="airport.icao" class="text-xs text-text-muted font-normal">
          ({{ airport.icao }})
        </span>
      </div>
      <UBadge
        size="xs"
        variant="subtle"
        :color="categoryBadge.color"
        class="font-mono text-[9px] uppercase tracking-wider shrink-0"
      >
        {{ categoryBadge.label }}
      </UBadge>
    </div>

    <!-- Nombre y Ubicación -->
    <div class="flex flex-col gap-0.5">
      <p class="text-xs font-semibold text-text-main leading-snug line-clamp-2" :title="airport.name">
        {{ airport.name }}
      </p>
      <p class="text-[11px] text-text-muted flex items-center gap-1">
        <UIcon name="i-lucide-map-pin" class="w-3 h-3 text-text-dim shrink-0" />
        <span class="truncate">{{ airport.city }}, {{ airport.country }}</span>
      </p>
    </div>

    <!-- Coordenadas Geográficas SRID 4326 -->
    <div class="flex items-center justify-between text-[10px] font-mono tabular-nums text-text-dim pt-1 border-t border-border-subtle/40">
      <span class="text-text-dim/80 uppercase tracking-wider text-[9px]">SRID 4326:</span>
      <span class="font-medium text-text-muted">{{ formattedCoordinates }}</span>
    </div>

    <!-- Contador de Conexiones Directas -->
    <div
      v-if="airport.connectionsCount !== undefined && airport.connectionsCount !== null"
      class="pt-1.5 border-t border-border-subtle/40 flex items-center justify-between text-[11px] font-mono text-text-dim"
    >
      <span class="flex items-center gap-1 text-text-muted">
        <UIcon name="i-lucide-route" class="w-3.5 h-3.5 text-primary/70 shrink-0" />
        <span>Conexiones directas:</span>
      </span>
      <span class="font-mono tabular-nums font-bold text-primary text-xs">
        {{ airport.connectionsCount }}
      </span>
    </div>
  </div>
</template>
