<script setup lang="ts">
import type { FlightRoute } from "~/types/route";

defineProps<{
  routes: FlightRoute[];
}>();

const emit = defineEmits<{
  (e: "focusRoute", route: FlightRoute): void;
}>();

function getAriaLabel(route: FlightRoute): string {
  const stopoverText = route.viaStopover
    ? `escala en ${route.viaStopover}`
    : "1 escala";
  return `Ruta con conexión ${route.originIata} hacia ${route.destinationIata}, operada por ${route.primaryAirline}, ${stopoverText}. Distancia: ${route.distanceKm.toLocaleString()} kilómetros. Puntualidad promedio: ${route.averageOtp15.toFixed(1)}% OTP-15. Presione para enfocar en mapa.`;
}
</script>

<template>
  <div v-if="routes.length > 0" class="flex flex-col gap-2">
    <!-- Encabezado de sección de Navegación Avionics -->
    <div class="flex items-center justify-between px-0.5">
      <span class="hud-section-label">
        <UIcon name="i-lucide-waypoints" class="w-3.5 h-3.5 text-primary" />
        <span>Alternativas con Escala / Conexión</span>
      </span>
      <span class="text-[10px] font-mono text-text-dim tabular-nums">
        {{ routes.length }} {{ routes.length === 1 ? 'alternativa' : 'alternativas' }}
      </span>
    </div>

    <!-- Lista de tarjetas de navegación -->
    <div class="flex flex-col gap-2">
      <div
        v-for="cRoute in routes"
        :key="cRoute.id"
        role="button"
        tabindex="0"
        :aria-label="getAriaLabel(cRoute)"
        class="group relative flex flex-col gap-2 p-2.5 rounded-xl bg-surface-base/60 hover:bg-surface-accent/80 border border-border-subtle/70 hover:border-primary/50 shadow-xs cursor-pointer select-none transform-gpu hover:translate-x-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
        @click="emit('focusRoute', cRoute)"
        @keydown.enter.prevent="emit('focusRoute', cRoute)"
        @keydown.space.prevent="emit('focusRoute', cRoute)"
      >
        <!-- Fila 1: Badges de Conexión + Desempeño OTP -->
        <div class="flex items-center justify-between gap-2">
          <!-- Waypoint / Stopover indicator badge + Aerolínea -->
          <div class="flex items-center gap-1.5 flex-wrap min-w-0">
            <span
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/10 border border-primary/25 text-primary shrink-0"
            >
              <UIcon name="i-lucide-git-commit-horizontal" class="w-3 h-3 text-primary shrink-0" />
              <span>{{ cRoute.viaStopover ? `VÍA ${cRoute.viaStopover}` : '1 ESCALA' }}</span>
            </span>

            <span
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-surface-accent/90 border border-border-subtle/60 text-text-muted truncate max-w-[140px]"
              :title="`Aerolínea principal: ${cRoute.primaryAirline}`"
            >
              <UIcon name="i-lucide-plane" class="w-2.5 h-2.5 text-text-dim shrink-0" />
              <span class="truncate">{{ cRoute.primaryAirline }}</span>
            </span>
          </div>

          <!-- OTP Badge con codificación sensorial -->
          <div class="shrink-0">
            <OtpBadge :value="cRoute.averageOtp15" />
          </div>
        </div>

        <!-- Fila 2: Origen ➔ Escala (opcional) ➔ Destino (font-mono tabular-nums font-bold) + Distancia -->
        <div class="flex items-center justify-between gap-2 font-mono tabular-nums">
          <div class="flex items-center gap-1.5 text-sm font-bold tracking-wide">
            <span class="text-text-main group-hover:text-primary transition-colors">
              {{ cRoute.originIata }}
            </span>

            <!-- Waypoint gráfico -->
            <template v-if="cRoute.viaStopover">
              <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-text-dim shrink-0" />
              <span
                class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-surface-accent border border-border-subtle/80 text-[10px] font-bold text-primary font-mono"
                :title="`Escala técnica / conexión en ${cRoute.viaStopover}`"
              >
                <span class="w-1 h-1 rounded-full bg-primary animate-pulse" />
                {{ cRoute.viaStopover }}
              </span>
              <UIcon name="i-lucide-arrow-right" class="w-3 h-3 text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </template>
            <template v-else>
              <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </template>

            <span class="text-text-main group-hover:text-primary transition-colors">
              {{ cRoute.destinationIata }}
            </span>
          </div>

          <!-- Distancia en km -->
          <div class="flex items-center gap-1 text-[11px] text-text-muted font-mono shrink-0">
            <UIcon name="i-lucide-milestone" class="w-3 h-3 text-text-dim shrink-0" />
            <span>{{ cRoute.distanceKm.toLocaleString() }} km</span>
          </div>
        </div>

        <!-- Fila 3: Detalle de ciudades y prompt interactivo -->
        <div class="flex items-center justify-between pt-1.5 border-t border-border-subtle/40 text-[10px] font-mono text-text-dim">
          <span class="truncate max-w-[180px]">
            {{ cRoute.originCity }} ➔ {{ cRoute.destinationCity }}
          </span>

          <span class="inline-flex items-center gap-1 text-text-dim group-hover:text-primary transition-colors font-medium shrink-0 ml-2">
            <UIcon name="i-lucide-crosshair" class="w-3 h-3 text-primary/70 group-hover:text-primary" />
            <span>Click para enfocar en mapa</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
