<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
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
  setOrigin,
  clearSelection,
  triggerFit,
} = useFlightSelection();

const isExpanded = ref(true);

// Si cambia la selección de aeropuertos, reabrir el drawer automáticamente
watch([selectedOrigin, selectedDestination], ([newOrig, newDest]) => {
  if (newOrig || newDest) {
    isExpanded.value = true;
  }
});

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

function handleBackToHub() {
  if (selectedOrigin.value) {
    setDestination(undefined);
  } else if (selectedDestination.value) {
    setOrigin(undefined);
  }
}
</script>

<template>
  <div>
    <!-- 1. Pestaña flotante de re-apertura cuando el drawer está colapsado a la izquierda -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
      enter-from-class="opacity-0 -translate-x-4"
      leave-to-class="opacity-0 -translate-x-4"
    >
      <button
        v-if="(selectedOrigin || selectedDestination) && !isExpanded"
        type="button"
        class="fixed z-40 top-26 md:top-26 left-3 md:left-6 pointer-events-auto cursor-pointer hud-card border border-border-subtle/80 bg-surface-card/95 backdrop-blur-xl px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-mono font-bold text-text-main hover:text-primary hover:border-primary/50 transition-all select-none group"
        title="Desplegar panel de resultados"
        aria-label="Desplegar panel de resultados"
        @click="isExpanded = true"
      >
        <UIcon
          name="i-lucide-panel-left-open"
          class="size-4 text-primary group-hover:scale-110 transition-transform"
        />
        <span
          v-if="selectedOrigin && selectedDestination"
          class="tracking-tight"
        >
          {{ selectedOrigin }} ➔ {{ selectedDestination }}
        </span>
        <span v-else class="tracking-tight">
          Hub {{ selectedOrigin || selectedDestination }} ({{
            matchingRoutes.length
          }})
        </span>
      </button>
    </Transition>

    <!-- 2. Drawer Lateral Izquierdo en Desktop (sin oscurecer ni bloquear el mapa) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-6 md:translate-y-0 md:-translate-x-[calc(100%+32px)]"
      leave-to-class="opacity-0 translate-y-6 md:translate-y-0 md:-translate-x-[calc(100%+32px)]"
    >
      <div
        v-if="(selectedOrigin || selectedDestination) && isExpanded"
        class="fixed z-40 pointer-events-auto select-none transition-all duration-300 bottom-3 inset-x-3 max-h-[85vh] md:max-h-none md:bottom-4 md:top-26 md:left-6 md:w-[520px] lg:w-[560px] xl:w-[620px] md:max-w-[calc(100vw-32px)] md:h-[calc(100vh-8rem)]"
      >
        <div
          class="hud-card border border-border-subtle/80 bg-surface-card/95 dark:bg-surface-base/92 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full transition-all"
        >
          <!-- Cabecera del Panel (Control Directo de Colapso y Navegación) -->
          <RouteHeader
            :selected-origin="selectedOrigin"
            :selected-destination="selectedDestination"
            :origin-airport="originAirport"
            :destination-airport="destinationAirport"
            :matching-count="matchingRoutes.length"
            :is-collapsed="!isExpanded"
            @toggle-collapse="isExpanded = false"
            @close="clearSelection"
            @open-search="openMobileSearch"
            @back-to-hub="handleBackToHub"
          />

          <!-- Contenido del Drawer con scroll vertical independiente a altura completa -->
          <div
            class="p-3.5 sm:p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto hud-scrollable"
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
                  class="py-6 text-center"
                >
                  <template #description>
                    <p class="text-xs text-text-muted max-w-xs mx-auto">
                      No se encontraron vuelos comerciales directos ni con
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
                    <div class="flex items-center justify-center gap-2 mt-3">
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
                        icon="i-lucide-x"
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
                  class="py-6 text-center"
                >
                  <template #actions>
                    <div class="flex items-center justify-center gap-2 mt-3">
                      <UButton
                        label="Limpiar selección"
                        icon="i-lucide-x"
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
        </div>
      </div>
    </Transition>
  </div>
</template>
