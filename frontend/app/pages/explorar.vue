<script setup lang="ts">
import { useShortcuts } from "~/features/flight-map/composables/useShortcuts";
import type { GlobalMapFilter } from '~/features/flight-map/composables/useGlobalMap';

useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Exploración de rutas del catálogo histórico; la puntualidad se muestra solo cuando hay datos operativos.",
});

const { aeropuertos, rutas, error, loadAirports, loadRoutes } = useCatalog();
const { selectedOrigin, selectedDestination, clearSelection } = useFlightSelection();
const globalMap = useGlobalMap();
const hasSelection = computed(() => Boolean(selectedOrigin.value || selectedDestination.value));
const globalAirportsCount = computed(() => {
  const ids = new Set(globalMap.visibleRoutes.value.flatMap(r => [r.origenId, r.destinoId]));
  return aeropuertos.value.filter(a => ids.has(a.id)).length;
});
let applying = false;
onMounted(() => {
  void loadAirports();
  if (hasSelection.value) void loadRoutes(selectedOrigin.value, selectedDestination.value);
  else { globalMap.isOpen.value = true; void globalMap.load(); }
});
onUnmounted(() => { globalMap.isOpen.value = false; });
watch([selectedOrigin, selectedDestination], ([origen, destino]) => {
  if (origen || destino) { void loadRoutes(origen, destino); return; }
  if (applying) { applying = false; return; }
  globalMap.isOpen.value = true;
  void globalMap.load();
});
function applyGlobalFilters(next: GlobalMapFilter) {
  applying = hasSelection.value;
  globalMap.filter.value = next;
  clearSelection();
  globalMap.isOpen.value = false;
  void globalMap.load();
}
// Inicializar atajos de teclado aeronáuticos del cockpit
useShortcuts();
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-background">
    <GlobalMapFilters @apply="applyGlobalFilters" />
    <div v-if="!hasSelection" class="hud-panel absolute z-20 hidden md:block bottom-5 left-6 w-80 p-4 text-sm text-text-main">
      <div role="status" aria-live="polite" :aria-busy="globalMap.loading.value">
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">En el mapa</p>
        <p v-if="globalMap.loading.value" class="flex items-center gap-2 py-2">
          <UIcon name="i-lucide-loader-circle" class="size-4 motion-safe:animate-spin text-primary" aria-hidden="true" />
          Cargando conexiones…
        </p>
        <template v-else-if="!globalMap.error.value">
          <dl class="grid grid-cols-2 divide-x divide-border-subtle">
            <div class="pr-3">
              <dt class="flex items-center gap-1.5 text-xs text-text-muted"><UIcon name="i-lucide-route" class="size-3.5 shrink-0" aria-hidden="true" />{{ globalMap.visibleRoutes.value.length === 1 ? 'Conexión' : 'Conexiones' }}</dt>
              <dd class="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">{{ globalMap.visibleRoutes.value.length }}</dd>
            </div>
            <div class="pl-3">
              <dt class="flex items-center gap-1.5 text-xs text-text-muted"><UIcon name="i-lucide-plane" class="size-3.5 shrink-0" aria-hidden="true" />{{ globalAirportsCount === 1 ? 'Aeropuerto' : 'Aeropuertos' }}</dt>
              <dd class="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums">{{ globalAirportsCount }}</dd>
            </div>
          </dl>
          <p v-if="!globalMap.visibleRoutes.value.length" class="mt-3 text-xs text-text-muted">No hay conexiones para estos filtros. Prueba otra zona de búsqueda.</p>
        </template>
      </div>
      <div v-if="globalMap.error.value" class="mt-2">
        <p role="alert" class="text-error">{{ globalMap.error.value }}</p>
        <UButton label="Reintentar" icon="i-lucide-refresh-cw" color="neutral" variant="ghost" class="mt-2 min-h-11" @click="globalMap.load" />
      </div>
      <div class="mt-4 border-t border-border-subtle pt-3">
        <UButton label="Cambiar filtros" icon="i-lucide-sliders-horizontal" color="primary" variant="soft" block class="min-h-11 justify-center rounded-xl font-semibold" aria-haspopup="dialog" :aria-expanded="globalMap.isOpen.value" @click="globalMap.isOpen.value = true" />
      </div>
    </div>
    <p v-if="error" role="alert" class="absolute z-50 bottom-4 left-4 rounded bg-surface-card p-3 text-error">{{ error }}</p>
    <!-- 1. Capa Base: Canvas WebGL MapLibre GL + Deck.gl -->
    <div class="absolute inset-0 z-0">
      <ClientOnly>
        <FlightMap />
      </ClientOnly>
    </div>

    <!-- 2. Capa Superior: Interfaz HUD y Header (Flotante) -->
    <div class="relative z-10 h-full w-full flex flex-col pointer-events-none">
      <div class="pointer-events-auto">
        <AppHeader :has-controls="true" :has-login="true" />
      </div>

      <main
        class="relative flex-1 overflow-hidden p-3 sm:p-6 pointer-events-none"
      >
        <!-- Panel Flotante de Resultados de Rutas / Desglose de Aerolíneas -->
        <RouteResults />

        <!-- HUD de Controles y Leyenda de Confiabilidad -->
        <HudWrapper />

        <!-- Drawer y Trigger de Búsqueda Móvil -->
        <MobileSearchDrawer />
      </main>
    </div>

    <!-- 3. Tooltip Refractivo Flotante (Picking sobre arcos y aeropuertos) -->
    <ClientOnly>
      <MapTooltip />
    </ClientOnly>
  </div>
</template>
