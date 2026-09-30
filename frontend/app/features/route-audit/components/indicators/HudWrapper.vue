<template>
  <div
    class="fixed z-30 flex items-end gap-3 pointer-events-none select-none top-20 right-3 sm:right-4 md:top-auto md:bottom-6 md:right-6 max-w-[calc(100vw-1.5rem)] md:max-w-fit"
  >
    <!-- Leyenda de Confiabilidad OTP-15 (Desktop, posicionada a la izquierda de los controles de mapa) -->
    <ReliabilityLegend class="hidden md:block pointer-events-auto shrink-0" />

    <!-- Clúster de Instrumentación HUD de Controles de Mapa (incluye Zoom, Vista y Manual de Atajos) -->
    <MapControls class="pointer-events-auto shrink-0" />

    <!-- Modal de Manual de Atajos de Cabina -->
    <CockpitShortcutsModal />
  </div>
</template>
