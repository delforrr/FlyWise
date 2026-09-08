<script setup lang="ts">
import type { FlightRoute } from "~/types/route";

defineProps<{
  routes: FlightRoute[];
}>();

const emit = defineEmits<{
  (e: "focusRoute", route: FlightRoute): void;
}>();
</script>

<template>
  <div v-if="routes.length > 0" class="flex flex-col gap-1.5">
    <span class="hud-section-label">
      <UIcon name="i-lucide-split" class="w-3.5 h-3.5 text-aero-cyan" />
      <span>Alternativas de Conexión en el Mapa:</span>
    </span>

    <div
      v-for="cRoute in routes"
      :key="cRoute.id"
      class="hud-interactive-item text-xs"
      @click="emit('focusRoute', cRoute)"
    >
      <div class="flex items-center gap-1.5 font-mono">
        <span class="font-bold text-text-main">{{ cRoute.originIata }}</span>
        <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-text-muted" />
        <span class="font-bold text-text-main">{{ cRoute.destinationIata }}</span>
        <span class="text-[10px] text-text-muted ml-1 font-sans">({{ cRoute.primaryAirline }})</span>
      </div>
      <HudOtpBadge :value="cRoute.averageOtp15" />
    </div>
  </div>
</template>
