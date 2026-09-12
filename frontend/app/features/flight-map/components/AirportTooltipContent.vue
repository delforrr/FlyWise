<script setup lang="ts">
import type { Airport } from "~/types/airport";

defineProps<{
  airport: Airport;
}>();
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
      <div class="flex items-center gap-1 font-mono font-bold text-base text-primary">
        <span>{{ airport.iata }}</span>
        <span v-if="airport.icao" class="text-xs text-text-dim font-normal">
          ({{ airport.icao }})
        </span>
      </div>
      <UBadge
        size="xs"
        variant="subtle"
        color="neutral"
        class="font-mono text-[10px]"
      >
        {{ airport.type === 'large_airport' ? 'HUB' : 'AEROPUERTO' }}
      </UBadge>
    </div>

    <p class="text-xs font-medium text-text-main truncate" :title="airport.name">
      {{ airport.name }}
    </p>

    <p class="text-[11px] text-text-muted">
      {{ airport.city }}, {{ airport.country }}
    </p>

    <div v-if="airport.connectionsCount" class="mt-1 pt-1 border-t border-border-subtle/40 flex items-center justify-between text-[11px] font-mono text-text-dim">
      <span>Conexiones directas:</span>
      <span class="text-primary font-bold">{{ airport.connectionsCount }}</span>
    </div>
  </div>
</template>
