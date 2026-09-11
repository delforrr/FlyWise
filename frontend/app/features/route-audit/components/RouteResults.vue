<script setup lang="ts">
import { SEED_AIRPORTS_BY_IATA } from "~/data/seedData";
import { type FlightRoute } from "~/types/route";

const {
  selectedOrigin,
  selectedDestination,
  matchingRoutes,
  selectedRouteData,
  openMobileSearch,
  setRoute,
  setDestination,
  clearSelection,
  triggerFit,
} = useFlightSelection();

const isCollapsed = ref(false);

const originAirport = computed(() => {
  if (!selectedOrigin.value) return null;
  return SEED_AIRPORTS_BY_IATA.get(selectedOrigin.value) ?? null;
});

const destinationAirport = computed(() => {
  if (!selectedDestination.value) return null;
  return SEED_AIRPORTS_BY_IATA.get(selectedDestination.value) ?? null;
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
    enter-from-class="opacity-0 translate-y-6 md:-translate-x-4 md:translate-y-0"
    leave-to-class="opacity-0 translate-y-6 md:-translate-x-4 md:translate-y-0"
  >
    <div
      v-if="selectedOrigin || selectedDestination"
      class="fixed z-40 pointer-events-auto select-none transition-all duration-300 bottom-3 inset-x-3 max-h-[85vh] md:bottom-auto md:top-25 md:left-6 md:w-100 md:max-w-[calc(100vw-24px)]"
    >
      <div
        class="hud-card border border-border-subtle/80 bg-surface-elevated/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
      >
        <!-- 1. Cabecera del Panel -->
        <RouteHeader
          :selected-origin="selectedOrigin"
          :selected-destination="selectedDestination"
          :origin-airport="originAirport"
          :destination-airport="destinationAirport"
          :matching-count="matchingRoutes.length"
          :is-collapsed="isCollapsed"
          @toggle-collapse="isCollapsed = !isCollapsed"
          @close="clearSelection"
          @open-search="openMobileSearch"
        />

        <!-- 2. Contenido Expandible -->
        <div
          v-show="!isCollapsed"
          class="p-3 flex flex-col gap-3 max-h-[50vh] md:max-h-[60vh] overflow-y-auto hud-scrollable"
        >
          <!-- CASO A: Par Origen - Destino seleccionado -->
          <template v-if="selectedOrigin && selectedDestination">
            <RouteDirectCard
              v-if="selectedRouteData"
              :route="selectedRouteData"
            />

            <RouteConnectingList
              :routes="connectingRoutes"
              @focus-route="handleFocusRoute"
            />
          </template>

          <!-- CASO B: Un solo aeropuerto seleccionado (Hub multiruta) -->
          <template v-else-if="selectedOrigin || selectedDestination">
            <RouteHubConnections
              :selected-origin="selectedOrigin"
              :routes="matchingRoutes"
              @select-destination="setDestination"
            />
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>
