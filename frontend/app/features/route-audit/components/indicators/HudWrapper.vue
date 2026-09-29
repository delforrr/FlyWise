<script setup lang="ts">
/**
 * Estado reactivo compartido para el control de apertura del manual de atajos de cabina.
 */
const isOpen = useState<boolean>('cockpit_shortcuts_modal', () => false);
</script>

<template>
  <div
    class="fixed z-30 flex items-end gap-3 pointer-events-none select-none top-20 right-3 sm:right-4 md:top-auto md:bottom-6 md:right-6 max-w-[calc(100vw-1.5rem)] md:max-w-fit"
  >
    <!-- Leyenda de Confiabilidad OTP-15 (Desktop, posicionada a la izquierda de los controles de mapa) -->
    <ReliabilityLegend class="hidden md:block pointer-events-auto shrink-0" />

    <!-- Botón táctico de apertura del Manual de Atajos de Cabina -->
    <div class="pointer-events-auto shrink-0">
      <UTooltip text="Manual de atajos (?)" :content="{ side: 'left' }">
        <UButton
          icon="i-lucide-keyboard"
          color="neutral"
          variant="ghost"
          aria-label="Manual de atajos (?)"
          class="relative flex items-center justify-center w-10 h-10 min-w-10 min-h-10 p-0 rounded-xl border border-border-subtle/80 border-t-white/35 dark:border-t-white/15 bg-surface-card/90 dark:bg-surface-base/85 backdrop-blur-xl shadow-2xl text-text-muted hover:text-primary hover:bg-surface-accent/80 hover:border-primary/40 hover:shadow-[0_0_14px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 transition-all duration-200 select-none cursor-pointer"
          @click="isOpen = true"
        />
      </UTooltip>
    </div>

    <!-- Clúster de Instrumentación HUD de Controles de Mapa -->
    <MapControls class="pointer-events-auto shrink-0" />

    <!-- Modal de Manual de Atajos de Cabina -->
    <CockpitShortcutsModal />
  </div>
</template>
