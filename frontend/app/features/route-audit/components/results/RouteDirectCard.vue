<script setup lang="ts">
import { computed } from "vue";
import type { FlightRoute } from "~/types/route";

const props = defineProps<{
  route: FlightRoute;
}>();

// Volumen total de vuelos comerciales muestreados y auditados
const sampleFlightsCount = computed(() => {
  return props.route.airlines.reduce(
    (total, a) => total + (a.sampleFlightsCount || 0),
    0,
  );
});

// Estilo y color del indicador de confiabilidad según OTP-15
const otpColorClass = computed(() => {
  if (props.route.averageOtp15 >= 85) return "text-emerald-500 dark:text-emerald-400";
  if (props.route.averageOtp15 >= 60) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
});

const progressBarClass = computed(() => {
  if (props.route.averageOtp15 >= 85) return "bg-emerald-500";
  if (props.route.averageOtp15 >= 60) return "bg-amber-500";
  return "bg-rose-500";
});

const bannerAccentClass = computed(() => {
  if (props.route.averageOtp15 >= 85) return "border-l-emerald-500";
  if (props.route.averageOtp15 >= 60) return "border-l-amber-500";
  return "border-l-rose-500";
});
</script>

<template>
  <div
    class="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-accent/80 dark:bg-surface-card/85 border border-border-subtle shadow-xs"
  >
    <!-- 1. Banner de Vuelo Directo con Estética Aeronáutica Elevada -->
    <div
      class="flex items-center justify-between p-2.5 rounded-xl bg-surface-base/80 dark:bg-surface-elevated/70 border border-border-subtle/70 shadow-xs relative overflow-hidden border-l-4"
      :class="bannerAccentClass"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs"
        >
          <UIcon name="i-lucide-plane-takeoff" class="w-4 h-4" />
        </div>
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold font-mono tracking-tight text-text-main">
              Vuelo Directo
            </span>
            <span
              class="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold tracking-wider bg-primary/15 text-primary border border-primary/25"
            >
              Non-Stop
            </span>
          </div>
          <span class="text-[10px] text-text-muted font-mono leading-none mt-0.5">
            Tramo punto a punto sin escalas
          </span>
        </div>
      </div>

      <OtpBadge :value="route.averageOtp15" class="shrink-0" />
    </div>

    <!-- 2. Telemetría de Ruta (Distancia Real y Muestra de Vuelos) -->
    <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
      <div
        class="flex items-center justify-between p-2 rounded-lg bg-surface-base/50 border border-border-subtle/40"
      >
        <span class="text-text-dim flex items-center gap-1">
          <UIcon name="i-lucide-navigation" class="w-3.5 h-3.5" />
          <span>Distancia:</span>
        </span>
        <span class="font-bold text-text-main tabular-nums">
          {{ route.distanceKm.toLocaleString() }} km
        </span>
      </div>

      <div
        class="flex items-center justify-between p-2 rounded-lg bg-surface-base/50 border border-border-subtle/40"
        title="Volumen total de vuelos auditados para esta ruta"
      >
        <span class="text-text-dim flex items-center gap-1">
          <UIcon name="i-lucide-database" class="w-3.5 h-3.5" />
          <span>Muestra:</span>
        </span>
        <span
          class="font-mono tabular-nums font-bold text-text-main inline-flex items-center gap-0.5"
        >
          {{ sampleFlightsCount.toLocaleString() }}
          <span class="text-[9px] font-normal text-text-dim">v</span>
        </span>
      </div>
    </div>

    <!-- 3. Mini Reliability Summary Bar & Volume Indicator -->
    <div
      class="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-base/50 dark:bg-surface-elevated/40 border border-border-subtle/50"
    >
      <div class="flex items-center justify-between text-[11px] font-mono">
        <div class="flex items-center gap-1.5 text-text-muted">
          <UIcon name="i-lucide-gauge" class="w-3.5 h-3.5 text-text-dim" />
          <span>Puntualidad Global OTP-15</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Sample flight volume badge -->
          <span
            v-if="sampleFlightsCount > 0"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold bg-surface-accent border border-border-subtle text-text-muted shadow-xs"
            title="Vuelos auditados en la muestra de esta ruta"
          >
            <UIcon name="i-lucide-layers" class="w-3 h-3 text-text-dim" />
            <span class="text-text-main">{{ sampleFlightsCount.toLocaleString() }}</span>
            <span class="text-[9px] font-normal text-text-dim">vuelos</span>
          </span>
          <span
            :class="['font-mono tabular-nums font-bold text-xs', otpColorClass]"
          >
            {{ route.averageOtp15.toFixed(1) }}%
          </span>
        </div>
      </div>

      <!-- Barra de confiabilidad visual con indicador de avance -->
      <div
        class="h-1.5 w-full bg-surface-container rounded-full overflow-hidden relative"
      >
        <div
          class="h-full rounded-full transition-all duration-300 ease-out"
          :class="progressBarClass"
          :style="{
            width: `${Math.min(100, Math.max(0, route.averageOtp15))}%`,
          }"
        />
      </div>
    </div>

    <!-- 4. Desglose de Aerolíneas Operadoras -->
    <div class="flex flex-col gap-1.5 border-t border-border-subtle/60 pt-2.5">
      <div class="flex items-center justify-between">
        <span class="hud-section-label">
          Desempeño por Aerolínea ({{ route.airlines.length }}):
        </span>
        <span class="text-[10px] font-mono text-text-dim">
          Tendencia 6m
        </span>
      </div>

      <RouteAirlineRow
        v-for="airline in route.airlines"
        :key="airline.airlineCode"
        :airline="airline"
      />
    </div>
  </div>
</template>
