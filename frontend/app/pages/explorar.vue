<script setup lang="ts">
import { useShortcuts } from "~/features/flight-map/composables/useShortcuts";

useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Exploración de rutas del catálogo histórico; la puntualidad se muestra solo cuando hay datos operativos.",
});

const { airports, routes, error, loadAirports, loadRoutes } = useCatalog();
const { selectedOrigin, selectedDestination } = useFlightSelection();
onMounted(async () => { await loadAirports(); await loadRoutes(selectedOrigin.value, selectedDestination.value); });
watch([selectedOrigin, selectedDestination], ([origin, destination]) => { void loadRoutes(origin, destination); });
// Inicializar atajos de teclado aeronáuticos del cockpit
useShortcuts();
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-background">
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
