<script setup lang="ts">
import { SEED_AIRPORTS } from "~/data/seedData";
import { type FlightRoute } from "~/types/route";

const {
  selectedOrigin,
  selectedDestination,
  matchingRoutes,
  selectedRouteData,
  setRoute,
  setDestination,
  clearSelection,
  triggerFit,
} = useFlightSelection();

const isCollapsed = ref(false);

const originAirport = computed(() => {
  if (!selectedOrigin.value) return null;
  return SEED_AIRPORTS.find((a) => a.iata === selectedOrigin.value) ?? null;
});

const destinationAirport = computed(() => {
  if (!selectedDestination.value) return null;
  return (
    SEED_AIRPORTS.find((a) => a.iata === selectedDestination.value) ?? null
  );
});

// Rutas directas para el par seleccionado
const directRoutes = computed(() => {
  if (!selectedOrigin.value || !selectedDestination.value) return [];
  return matchingRoutes.value.filter(
    (r) =>
      (r.originIata === selectedOrigin.value &&
        r.destinationIata === selectedDestination.value) ||
      (r.originIata === selectedDestination.value &&
        r.destinationIata === selectedOrigin.value),
  );
});

// Rutas de escala o alternativas para el par seleccionado
const connectingRoutes = computed(() => {
  if (!selectedOrigin.value || !selectedDestination.value) return [];
  return matchingRoutes.value.filter(
    (r) =>
      !(
        (r.originIata === selectedOrigin.value &&
          r.destinationIata === selectedDestination.value) ||
        (r.originIata === selectedDestination.value &&
          r.destinationIata === selectedOrigin.value)
      ),
  );
});

function handleSelectDestination(destIata: string) {
  setDestination(destIata);
}

function handleFocusRoute(route: FlightRoute) {
  setRoute(route.originIata, route.destinationIata);
  nextTick(() => {
    triggerFit();
  });
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="opacity-0 -translate-x-4"
    leave-to-class="opacity-0 -translate-x-4"
  >
    <div
      v-if="selectedOrigin || selectedDestination"
      class="fixed top-20 sm:top-24 left-3 sm:left-6 z-40 w-72 sm:w-84 max-w-[calc(100vw-24px)] pointer-events-auto select-none"
    >
      <div
        class="hud-card border border-border-subtle/80 bg-surface-elevated/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
      >
        <!-- Header del Panel -->
        <div
          class="p-3.5 border-b border-border-subtle/50 flex items-center justify-between bg-surface-card/50"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <div
              class="w-2.5 h-2.5 rounded-full bg-aero-cyan animate-pulse shrink-0"
            />
            <div class="truncate">
              <h3
                class="text-xs font-bold font-mono text-text-main uppercase tracking-wider truncate"
              >
                <template v-if="selectedOrigin && selectedDestination">
                  {{ selectedOrigin }} ➔ {{ selectedDestination }}
                </template>
                <template v-else-if="selectedOrigin">
                  Hub {{ selectedOrigin }}
                </template>
                <template v-else> Destino {{ selectedDestination }} </template>
              </h3>
              <p class="text-[10px] text-text-muted truncate">
                <template v-if="originAirport && destinationAirport">
                  {{ originAirport.city }} hacia {{ destinationAirport.city }}
                </template>
                <template v-else-if="originAirport">
                  {{ originAirport.name }} ({{
                    matchingRoutes.length
                  }}
                  conexiones)
                </template>
                <template v-else-if="destinationAirport">
                  Llegadas a {{ destinationAirport.city }}
                </template>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <UButton
              :icon="
                isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'
              "
              variant="ghost"
              size="xs"
              class="text-text-muted hover:text-text-main"
              aria-label="Minimizar panel de resultados"
              @click="isCollapsed = !isCollapsed"
            />
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              class="text-text-muted hover:text-text-main"
              aria-label="Cerrar resultados"
              @click="clearSelection"
            />
          </div>
        </div>

        <!-- Contenido Expandible -->
        <div
          v-show="!isCollapsed"
          class="p-3 flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar"
        >
          <!-- CASO A: Par Origen - Destino seleccionado -->
          <template v-if="selectedOrigin && selectedDestination">
            <!-- Ruta directa -->
            <div
              v-if="selectedRouteData"
              class="flex flex-col gap-2 p-2.5 rounded-xl bg-surface-card/60 border border-border-subtle/60"
            >
              <div class="flex items-center justify-between">
                <div
                  class="flex items-center gap-1 text-xs font-mono font-bold text-text-main"
                >
                  <span>Vuelo Directo</span>
                </div>
                <HudOtpBadge :value="selectedRouteData.averageOtp15" />
              </div>

              <div class="text-[11px] text-text-muted flex justify-between">
                <span>Distancia ortodrómica:</span>
                <span class="font-mono font-medium text-text-main">
                  {{ selectedRouteData.distanceKm.toLocaleString() }} km
                </span>
              </div>

              <!-- Desglose de Aerolíneas -->
              <div
                class="mt-1 flex flex-col gap-1.5 border-t border-border-subtle/40 pt-2"
              >
                <span
                  class="text-[10px] font-mono uppercase text-text-dim tracking-wider"
                >
                  Desempeño por Aerolínea:
                </span>

                <div
                  v-for="airline in selectedRouteData.airlines"
                  :key="airline.airlineCode"
                  class="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg bg-surface-base/50"
                >
                  <div class="flex flex-col">
                    <span class="font-medium text-text-main">{{
                      airline.airlineName
                    }}</span>
                    <span class="text-[10px] text-text-muted font-mono">
                      Demora media: ~{{ airline.avgDelayMinutes }} min · Canc:
                      {{ airline.cancellationRate }}%
                    </span>
                  </div>
                  <HudOtpBadge :value="airline.otp15" />
                </div>
              </div>
            </div>

            <!-- Opciones con escala si existen -->
            <div
              v-if="connectingRoutes.length > 0"
              class="flex flex-col gap-1.5"
            >
              <span
                class="text-[10px] font-mono uppercase text-text-dim tracking-wider flex items-center gap-1"
              >
                <UIcon
                  name="i-lucide-split"
                  class="w-3.5 h-3.5 text-aero-cyan"
                />
                <span>Alternativas de Conexión en el Mapa:</span>
              </span>

              <div
                v-for="cRoute in connectingRoutes"
                :key="cRoute.id"
                class="p-2 rounded-lg bg-surface-card/40 border border-border-subtle/40 flex items-center justify-between text-xs cursor-pointer hover:bg-surface-card transition-colors"
                @click="handleFocusRoute(cRoute)"
              >
                <div class="flex items-center gap-1.5 font-mono">
                  <span class="font-bold text-text-main">{{
                    cRoute.originIata
                  }}</span>
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="w-3 h-3 text-text-muted"
                  />
                  <span class="font-bold text-text-main">{{
                    cRoute.destinationIata
                  }}</span>
                  <span class="text-[10px] text-text-muted ml-1"
                    >({{ cRoute.primaryAirline }})</span
                  >
                </div>
                <HudOtpBadge :value="cRoute.averageOtp15" />
              </div>
            </div>
          </template>

          <!-- CASO B: Un solo aeropuerto seleccionado (Hub de Rutas Múltiples) -->
          <template v-else-if="selectedOrigin || selectedDestination">
            <div
              class="flex items-center justify-between text-[11px] font-mono text-text-muted pb-1 border-b border-border-subtle/40"
            >
              <span>{{ matchingRoutes.length }} Rutas conectadas:</span>
              <span class="text-[10px]">Click para aislar</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <div
                v-for="route in matchingRoutes"
                :key="route.id"
                class="p-2 rounded-xl bg-surface-card/50 border border-border-subtle/50 flex items-center justify-between text-xs cursor-pointer hover:bg-surface-card hover:border-aero-cyan/40 transition-all duration-150 group"
                @click="
                  handleSelectDestination(
                    selectedOrigin === route.originIata
                      ? route.destinationIata
                      : route.originIata,
                  )
                "
              >
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5 font-mono">
                    <span
                      class="font-bold text-text-main group-hover:text-aero-cyan transition-colors"
                    >
                      {{ route.originIata }}
                    </span>
                    <UIcon
                      name="i-lucide-arrow-right"
                      class="w-3 h-3 text-text-muted"
                    />
                    <span
                      class="font-bold text-text-main group-hover:text-aero-cyan transition-colors"
                    >
                      {{ route.destinationIata }}
                    </span>
                  </div>
                  <span class="text-[10px] text-text-muted truncate max-w-40">
                    {{ route.destinationCity }} · {{ route.primaryAirline }}
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <span
                    class="font-mono text-[10px] text-text-muted hidden sm:inline"
                  >
                    {{ route.distanceKm.toLocaleString() }}km
                  </span>
                  <HudOtpBadge :value="route.averageOtp15" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
</style>
