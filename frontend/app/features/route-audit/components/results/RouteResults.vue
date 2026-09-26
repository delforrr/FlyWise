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

const isExpanded = ref(true);

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
        class="hud-card border border-border-subtle/80 bg-surface-accent/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
      >
        <UCollapsible
          v-model:open="isExpanded"
          :unmount-on-hide="false"
          class="flex flex-col"
        >
          <!-- 1. Cabecera del Panel -->
          <RouteHeader
            :selected-origin="selectedOrigin"
            :selected-destination="selectedDestination"
            :origin-airport="originAirport"
            :destination-airport="destinationAirport"
            :matching-count="matchingRoutes.length"
            :is-collapsed="!isExpanded"
            @toggle-collapse="isExpanded = !isExpanded"
            @close="clearSelection"
            @open-search="openMobileSearch"
          />

          <!-- 2. Contenido Expandible -->
          <template #content>
            <div
              class="p-3 flex flex-col gap-3 max-h-[50vh] md:max-h-[60vh] overflow-y-auto hud-scrollable"
            >
              <!-- CASO A: Par Origen - Destino seleccionado -->
              <template v-if="selectedOrigin && selectedDestination">
                <!-- Subcaso A.1: Existen rutas directas o conexiones -->
                <template v-if="selectedRouteData || connectingRoutes.length > 0">
                  <RouteDirectCard
                    v-if="selectedRouteData"
                    :route="selectedRouteData"
                  />

                  <RouteConnectingList
                    :routes="connectingRoutes"
                    @focus-route="handleFocusRoute"
                  />
                </template>

                <!-- Subcaso A.2: Sin rutas coincidentes (Empty State) -->
                <template v-else>
                  <UEmpty
                    icon="i-lucide-plane"
                    title="Sin rutas disponibles"
                    variant="naked"
                    size="sm"
                    class="py-4 text-center"
                  >
                    <template #description>
                      <p class="text-xs text-text-muted max-w-xs">
                        No se encontraron vuelos comerciales directos ni con 1
                        escala entre
                        <span class="font-mono font-bold text-text-main">{{
                          selectedOrigin
                        }}</span>
                        y
                        <span class="font-mono font-bold text-text-main">{{
                          selectedDestination
                        }}</span
                        >.
                      </p>
                    </template>

                    <template #actions>
                      <div class="flex items-center gap-2 mt-2">
                        <UButton
                          label="Ver salidas de origen"
                          icon="i-lucide-arrow-left"
                          size="xs"
                          variant="subtle"
                          color="primary"
                          @click="setDestination(undefined)"
                        />
                        <UButton
                          label="Limpiar selección"
                          icon="i-lucide-rotate-ccw"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="clearSelection"
                        />
                      </div>
                    </template>
                  </UEmpty>
                </template>
              </template>

              <!-- CASO B: Un solo aeropuerto seleccionado (Hub multiruta) -->
              <template v-else-if="selectedOrigin || selectedDestination">
                <RouteHubConnections
                  v-if="matchingRoutes.length > 0"
                  :selected-origin="selectedOrigin"
                  :routes="matchingRoutes"
                  @select-destination="setDestination"
                />
                <template v-else>
                  <UEmpty
                    icon="i-lucide-plane"
                    title="Aeropuerto sin rutas activas"
                    description="No registramos rutas comerciales conectadas para este aeropuerto."
                    variant="naked"
                    size="sm"
                    class="py-4 text-center"
                  >
                    <template #actions>
                      <div class="flex items-center gap-2 mt-2">
                        <UButton
                          label="Limpiar selección"
                          icon="i-lucide-rotate-ccw"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="clearSelection"
                        />
                      </div>
                    </template>
                  </UEmpty>
                </template>
              </template>
            </div>
          </template>
        </UCollapsible>
      </div>
    </div>
  </Transition>
</template>
