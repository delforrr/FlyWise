<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useCatalog } from "~/shared/composables/useCatalog";
const { airports } = useCatalog();
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
  return airports.value.find(a => a.id === selectedOrigin.value) ?? null;
});

const destinationAirport = computed(() => {
  if (!selectedDestination.value) return null;
  return airports.value.find(a => a.id === selectedDestination.value) ?? null;
});

// Rutas de escala o alternativas para el par seleccionado
const connectingRoutes = computed<FlightRoute[]>(() => []);

function handleFocusRoute(route: FlightRoute) {
  setRoute(route.originId, route.destinationId);
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
    <!-- 1. Pestaña flotante de re-apertura con UButton nativo -->
    <UButton
      v-if="(selectedOrigin || selectedDestination) && !isExpanded"
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-panel-left-open"
      class="fixed z-40 xs:top-18 sm:top-26 left-3 md:left-6 pointer-events-auto cursor-pointer bg-surface-card/95 backdrop-blur-xl border-border-subtle/80 hover:border-primary/50 shadow-xl font-mono font-bold text-xs"
      title="Desplegar panel de resultados"
      aria-label="Desplegar panel de resultados"
      @click="isExpanded = true"
    >
      <span v-if="selectedOrigin && selectedDestination" class="tracking-tight">
        {{ originAirport?.iata ?? "Origen" }} ➔ {{ destinationAirport?.iata ?? "Destino" }}
      </span>
      <span v-else class="tracking-tight">
        Hub {{ originAirport?.iata ?? destinationAirport?.iata }} ({{
          matchingRoutes.length
        }})
      </span>
    </UButton>

    <!-- 2. Panel Lateral Izquierdo de Resultados (Contenedor Nativo UCard) -->
    <div
      v-if="(selectedOrigin || selectedDestination) && isExpanded"
      class="fixed z-40 pointer-events-auto select-none bottom-3 inset-x-3 max-h-[85vh] md:max-h-none md:bottom-4 md:top-26 md:left-6 md:w-130 lg:w-140 xl:w-155 md:max-w-[calc(100vw-32px)] md:h-[calc(100vh-8rem)]"
    >
      <UCard
        variant="subtle"
        :ui="{
          root: 'border-border-subtle/80 bg-surface-card/95 dark:bg-surface-base/92 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full',
          header: 'p-0 sm:p-0',
          body: 'p-3.5 sm:p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto hud-scrollable',
        }"
      >
        <template #header>
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
        </template>

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
                  No se encontró una oferta directa en el catálogo histórico
                  entre
                  <span class="font-mono font-bold text-text-main">{{ originAirport?.iata ?? "Origen" }}</span>
                  y
                  <span class="font-mono font-bold text-text-main">{{ destinationAirport?.iata ?? "Destino" }}</span
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
      </UCard>
    </div>
  </div>
</template>
