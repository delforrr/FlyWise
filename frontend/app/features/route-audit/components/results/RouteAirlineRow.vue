<script setup lang="ts">
import type { AirlinePerformance } from "~/types/route";

defineProps<{
  airline: AirlinePerformance;
}>();
</script>

<template>
  <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-base/50 border border-border-subtle/30">
    <div class="flex flex-col">
      <span class="font-medium text-text-main">{{ airline.airlineName }}</span>
      <span class="text-[10px] text-text-muted font-mono">
        Demora media: ~{{ airline.avgDelayMinutes }} min · Canc: {{ airline.cancellationRate }}%
      </span>
    </div>
    <OtpBadge :value="airline.otp15" />
  </div>
</template>
