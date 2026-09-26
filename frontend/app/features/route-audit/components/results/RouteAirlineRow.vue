<script setup lang="ts">
import type { RouteAirlinePerformance } from "~/types/route";

defineProps<{
  airline: RouteAirlinePerformance;
}>();
</script>

<template>
  <div
    class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-surface-base/50 hover:bg-surface-accent/60 border border-border-subtle/40 hover:border-border-subtle/70 transform-gpu transition-colors duration-150 select-none group"
  >
    <!-- Columna Izquierda: Código IATA de Aerolínea y Nombre Comercial -->
    <div class="flex items-center gap-2 min-w-0 pr-2">
      <!-- Código de vuelo / aerolínea IATA con ancho fijo y números tabulares -->
      <span
        class="inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-mono font-bold tabular-nums tracking-wider bg-surface-accent border border-border-subtle/60 text-primary shrink-0"
        :title="`Código IATA: ${airline.airlineCode}`"
      >
        {{ airline.airlineCode }}
      </span>

      <div class="flex flex-col min-w-0">
        <span class="font-medium text-text-main truncate text-xs leading-tight">
          {{ airline.airlineName }}
        </span>
        <!-- Columnas numéricas alineadas verticalmente para evitar CLS -->
        <div class="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
          <span class="inline-flex items-center gap-1 font-mono">
            <span class="text-text-dim">Demora:</span>
            <span class="font-mono tabular-nums font-semibold text-text-main w-8 text-right inline-block">
              ~{{ airline.avgDelayMinutes }}m
            </span>
          </span>

          <span class="text-border-subtle shrink-0">·</span>

          <span class="inline-flex items-center gap-1 font-mono">
            <span class="text-text-dim">Canc:</span>
            <span class="font-mono tabular-nums font-semibold text-text-main w-8 text-right inline-block">
              {{ airline.cancellationRate }}%
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Columna Derecha: Badge OTP-15 con ancho fijo para estabilidad visual -->
    <div class="shrink-0 flex items-center justify-end">
      <OtpBadge :value="airline.otp15" class="font-mono tabular-nums" />
    </div>
  </div>
</template>

