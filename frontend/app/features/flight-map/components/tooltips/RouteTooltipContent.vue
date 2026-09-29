<script setup lang="ts">
import { computed } from "vue";
import type { FlightRoute } from "~/types/route";

const props = defineProps<{
  route: FlightRoute;
}>();

// Distancia en millas náuticas (1 nm = 1.852 km)
const distanceNm = computed<number>(() => {
  return Math.round(props.route.distanceKm / 1.852);
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Header: Par de ruta con icono direccional y distancia combinada (km y nm) -->
    <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5 gap-2">
      <div class="flex items-center gap-1.5 font-mono text-sm font-bold text-text-main">
        <span class="text-primary">{{ route.originIata }}</span>
        <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-primary shrink-0" />
        <span class="text-primary">{{ route.destinationIata }}</span>
      </div>
      <div class="flex items-center gap-1 font-mono tabular-nums text-[11px] text-text-muted font-medium shrink-0">
        <span>{{ route.distanceKm.toLocaleString() }} km</span>
        <span class="text-text-dim/60">/</span>
        <span>{{ distanceNm.toLocaleString() }} nm</span>
      </div>
    </div>

    <!-- Nombres de ciudades origen y destino -->
    <p class="text-[11px] text-text-muted truncate">
      {{ route.originCity }}
      <span class="text-text-dim px-0.5">➔</span>
      {{ route.destinationCity }}
    </p>

    <!-- Aerolínea principal -->
    <div class="text-xs text-text-muted flex justify-between items-center pt-1 border-t border-border-subtle/40">
      <span class="text-text-muted flex items-center gap-1">
        <UIcon name="i-lucide-plane-takeoff" class="w-3.5 h-3.5 text-text-dim shrink-0" />
        <span>Aerolínea principal:</span>
      </span>
      <span class="font-medium text-text-main truncate max-w-[130px] text-right" :title="route.primaryAirline">
        {{ route.primaryAirline }}
      </span>
    </div>

    <!-- Métrica de puntualidad OTP-15 con OtpBadge -->
    <div class="mt-0.5 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between gap-2">
      <span class="text-[11px] uppercase tracking-wider text-text-dim font-mono font-medium">Puntualidad:</span>
      <OtpBadge :value="route.averageOtp15" />
    </div>
  </div>
</template>
