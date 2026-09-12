<script setup lang="ts">
import type { FlightRoute } from "~/types/route";

defineProps<{
  route: FlightRoute;
}>();
</script>

<template>
  <div class="flex flex-col gap-2.5 p-3 rounded-xl bg-surface-card/60 border border-border-subtle/60 shadow-sm">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5 text-xs font-mono font-bold text-text-main">
        <UIcon name="i-lucide-plane" class="w-3.5 h-3.5 text-primary" />
        <span>Vuelo Directo</span>
      </div>
      <OtpBadge :value="route.averageOtp15" />
    </div>

    <div class="text-[11px] text-text-muted flex justify-between items-center font-mono">
      <span>Distancia ortodrómica:</span>
      <span class="font-medium text-text-main">
        {{ route.distanceKm.toLocaleString() }} km
      </span>
    </div>

    <!-- Desglose de Aerolíneas -->
    <div class="flex flex-col gap-1.5 border-t border-border-subtle/40 pt-2">
      <span class="hud-section-label">
        Desempeño por Aerolínea:
      </span>

      <RouteAirlineRow
        v-for="airline in route.airlines"
        :key="airline.airlineCode"
        :airline="airline"
      />
    </div>
  </div>
</template>
