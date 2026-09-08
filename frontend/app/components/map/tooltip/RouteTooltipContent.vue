<script setup lang="ts">
import type { FlightRoute } from "~/types/route";

defineProps<{
  route: FlightRoute;
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
      <div class="flex items-center gap-1.5 font-mono text-sm font-bold text-text-main">
        <span class="text-aero-cyan">{{ route.originIata }}</span>
        <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-text-dim" />
        <span class="text-aero-cyan">{{ route.destinationIata }}</span>
      </div>
      <span class="font-mono text-[11px] text-text-muted">
        {{ route.distanceKm.toLocaleString() }} km
      </span>
    </div>

    <div class="text-xs text-text-muted flex justify-between items-center">
      <span>Aerolínea principal:</span>
      <span class="font-medium text-text-main">{{ route.primaryAirline }}</span>
    </div>

    <div class="mt-1 flex items-center justify-between">
      <span class="text-[11px] uppercase tracking-wider text-text-dim font-mono">Puntualidad:</span>
      <HudOtpBadge :value="route.averageOtp15" />
    </div>
  </div>
</template>
