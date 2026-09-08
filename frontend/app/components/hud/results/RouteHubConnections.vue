<script setup lang="ts">
import type { FlightRoute } from "~/types/route";

const props = defineProps<{
  selectedOrigin?: string | null;
  routes: FlightRoute[];
}>();

const emit = defineEmits<{
  (e: "selectDestination", iata: string): void;
}>();

function handleClick(route: FlightRoute) {
  const dest = props.selectedOrigin === route.originIata
    ? route.destinationIata
    : route.originIata;
  emit("selectDestination", dest);
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between text-[11px] font-mono text-text-muted pb-1 border-b border-border-subtle/40">
      <span>{{ routes.length }} Rutas conectadas:</span>
      <span class="text-[10px] text-text-dim">Click para aislar</span>
    </div>

    <div class="flex flex-col gap-1.5">
      <div
        v-for="route in routes"
        :key="route.id"
        class="hud-interactive-item group text-xs"
        @click="handleClick(route)"
      >
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5 font-mono">
            <span class="font-bold text-text-main group-hover:text-aero-cyan transition-colors">
              {{ route.originIata }}
            </span>
            <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-text-muted" />
            <span class="font-bold text-text-main group-hover:text-aero-cyan transition-colors">
              {{ route.destinationIata }}
            </span>
          </div>
          <span class="text-[10px] text-text-muted truncate max-w-40 font-sans">
            {{ route.destinationCity }} · {{ route.primaryAirline }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] text-text-muted hidden sm:inline">
            {{ route.distanceKm.toLocaleString() }}km
          </span>
          <HudOtpBadge :value="route.averageOtp15" />
        </div>
      </div>
    </div>
  </div>
</template>
