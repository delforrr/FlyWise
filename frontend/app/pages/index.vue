<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Visualización de confiabilidad histórica y métricas de aerolíneas en tiempo real.",
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-background">
    <!-- 1. Capa Base: Canvas WebGL MapLibre GL + Deck.gl -->
    <div class="absolute inset-0 z-0">
      <ClientOnly>
        <MapFlightMap />
      </ClientOnly>
    </div>

    <!-- 2. Capa Superior: Interfaz HUD y Header (Flotante) -->
    <div class="relative z-10 h-full w-full flex flex-col pointer-events-none">
      <div class="pointer-events-auto">
        <LayoutHeader />
      </div>

      <main class="relative flex-1 overflow-hidden p-3 sm:p-6 pointer-events-none">
        <!-- Panel Flotante de Resultados de Rutas / Desglose de Aerolíneas -->
        <HudRouteResults />

        <!-- HUD de Controles y Leyenda de Confiabilidad -->
        <HudWrapper />

        <!-- Drawer y Trigger de Búsqueda Móvil -->
        <HudSearchMobileSearchDrawer />
      </main>
    </div>

    <!-- 3. Tooltip Refractivo Flotante (Picking sobre arcos y aeropuertos) -->
    <ClientOnly>
      <MapTooltip />
    </ClientOnly>
  </div>
</template>
