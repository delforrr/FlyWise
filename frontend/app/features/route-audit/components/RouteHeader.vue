<script setup lang="ts">
import type { Airport } from "~/types/airport";

defineProps<{
  selectedOrigin?: string | null;
  selectedDestination?: string | null;
  originAirport: Airport | null;
  destinationAirport: Airport | null;
  matchingCount: number;
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: "toggleCollapse"): void;
  (e: "close"): void;
  (e: "openSearch"): void;
}>();
</script>

<template>
  <div class="hud-panel-header">
    <div class="flex items-center gap-2 overflow-hidden">
      <div class="w-2.5 h-2.5 rounded-full bg-aero-cyan animate-pulse shrink-0" />
      <div class="truncate">
        <h3 class="text-xs font-bold font-mono text-text-main uppercase tracking-wider truncate">
          <template v-if="selectedOrigin && selectedDestination">
            {{ selectedOrigin }} ➔ {{ selectedDestination }}
          </template>
          <template v-else-if="selectedOrigin">
            Hub {{ selectedOrigin }}
          </template>
          <template v-else>
            Destino {{ selectedDestination }}
          </template>
        </h3>
        <p class="text-[10px] text-text-muted truncate">
          <template v-if="originAirport && destinationAirport">
            {{ originAirport.city }} hacia {{ destinationAirport.city }}
          </template>
          <template v-else-if="originAirport">
            {{ originAirport.name }} ({{ matchingCount }} conexiones)
          </template>
          <template v-else-if="destinationAirport">
            Llegadas a {{ destinationAirport.city }}
          </template>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <!-- Botón para reabrir drawer de búsqueda en móvil -->
      <UButton
        icon="i-lucide-search"
        variant="ghost"
        size="xs"
        class="text-aero-cyan hover:text-aero-cyan/80 md:hidden"
        aria-label="Modificar búsqueda"
        title="Modificar búsqueda"
        @click="emit('openSearch')"
      />
      <UButton
        :icon="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
        variant="ghost"
        size="xs"
        class="text-text-muted hover:text-text-main"
        aria-label="Minimizar panel de resultados"
        @click="emit('toggleCollapse')"
      />
      <UButton
        icon="i-lucide-x"
        variant="ghost"
        size="xs"
        class="text-text-muted hover:text-text-main"
        aria-label="Cerrar resultados"
        @click="emit('close')"
      />
    </div>
  </div>
</template>
