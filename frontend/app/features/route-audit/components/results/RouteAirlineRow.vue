<script setup lang="ts">
import type { RouteAirlinePerformance } from "~/types/route";

defineProps<{
  airline: RouteAirlinePerformance;
}>();
</script>

<template>
  <div
    class="flex flex-col gap-1.5 text-xs py-2 px-3 rounded-xl bg-surface-base/50 hover:bg-surface-accent/70 border border-border-subtle/50 hover:border-border-subtle/80 transform-gpu transition-all duration-150 select-none group shadow-xs"
  >
    <!-- Fila 1: Identidad de Aerolínea (Izquierda) + Calificación OTP-15 (Derecha) -->
    <div class="flex items-center justify-between gap-3 w-full">
      <div class="flex items-center gap-2 min-w-0">
        <!-- Código de vuelo / aerolínea IATA con ancho fijo y números tabulares -->
        <span
          class="inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-mono font-bold tabular-nums tracking-wider bg-surface-accent border border-border-subtle/70 text-primary shrink-0 shadow-xs"
          :title="`Código IATA: ${airline.airlineCode}`"
        >
          {{ airline.airlineCode }}
        </span>

        <!-- Nombre comercial -->
        <span class="font-semibold text-text-main truncate text-xs leading-tight">
          {{ airline.airlineName }}
        </span>
      </div>

      <!-- Badge OTP-15 en esquina superior derecha con espacio holgado -->
      <div class="shrink-0 flex items-center justify-end">
        <OtpBadge :value="airline.otp15" class="font-mono tabular-nums" />
      </div>
    </div>

    <!-- Fila 2: Sub-barra de Telemetría Operativa (Demora Promedio y Cancelación) -->
    <div
      class="flex items-center justify-between pt-1.5 border-t border-border-subtle/40 text-[11px] text-text-muted font-mono"
    >
      <div class="flex items-center gap-1.5">
        <UIcon name="i-lucide-clock-3" class="w-3.5 h-3.5 text-text-dim" />
        <span class="text-text-dim">Demora prom:</span>
        <span class="tabular-nums font-semibold text-text-main">
          ~{{ airline.avgDelayMinutes }}m
        </span>
      </div>

      <span class="text-border-subtle/60">·</span>

      <div class="flex items-center gap-1.5">
        <UIcon name="i-lucide-circle-slash" class="w-3.5 h-3.5 text-text-dim" />
        <span class="text-text-dim">Cancelación:</span>
        <span
          :class="[
            'tabular-nums font-semibold',
            airline.cancellationRate > 5
              ? 'text-error'
              : airline.cancellationRate > 2
                ? 'text-warning'
                : 'text-text-main',
          ]"
        >
          {{ airline.cancellationRate }}%
        </span>
      </div>
    </div>
  </div>
</template>

