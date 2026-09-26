<script setup lang="ts">
import { computed } from "vue";
import type { Airport } from "~/types/airport";
import AnimatedCounter from "~/shared/components/ui/AnimatedCounter.vue";

const props = defineProps<{
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

// Cálculo ortodrómico de distancia (km y millas náuticas nm)
const distanceKm = computed<number | null>(() => {
  if (!props.originAirport?.coordinates || !props.destinationAirport?.coordinates) {
    return null;
  }
  const [lon1, lat1] = props.originAirport.coordinates;
  const [lon2, lat2] = props.destinationAirport.coordinates;
  const R = 6371; // Radio terrestre medio en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
});

const distanceNm = computed<number | null>(() => {
  if (distanceKm.value === null) return null;
  return Math.round(distanceKm.value * 0.539957);
});

// Formateo de coordenadas geográficas [lon, lat] bajo estándar SRID 4326
function formatCoordinates(coords?: [number, number]): string {
  if (!coords || coords.length < 2) return "--";
  const [lon, lat] = coords;
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}
</script>

<template>
  <div class="hud-panel-header !flex-col !items-stretch !p-3">
    <!-- Zona 1: Identificación de Ruta, Baliza y Controles de Ventana -->
    <div class="flex items-center justify-between gap-2 w-full">
      <div class="flex items-center gap-2 overflow-hidden min-w-0">
        <div class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
        <div class="truncate">
          <h3 class="text-xs font-bold font-mono text-text-main uppercase tracking-wider truncate flex items-center gap-1.5">
            <template v-if="selectedOrigin && selectedDestination">
              <span class="font-mono tabular-nums tracking-tight">{{ selectedOrigin }}</span>
              <span class="text-primary font-bold">➔</span>
              <span class="font-mono tabular-nums tracking-tight">{{ selectedDestination }}</span>
            </template>
            <template v-else-if="selectedOrigin">
              <span>Hub</span>
              <span class="font-mono tabular-nums tracking-tight text-primary">{{ selectedOrigin }}</span>
            </template>
            <template v-else>
              <span>Destino</span>
              <span class="font-mono tabular-nums tracking-tight text-primary">{{ selectedDestination }}</span>
            </template>
          </h3>
          <p class="text-[10px] text-text-muted truncate leading-tight mt-0.5">
            <template v-if="originAirport && destinationAirport">
              {{ originAirport.city }} hacia {{ destinationAirport.city }}
            </template>
            <template v-else-if="originAirport">
              {{ originAirport.name }}
            </template>
            <template v-else-if="destinationAirport">
              Llegadas a {{ destinationAirport.city }}
            </template>
          </p>
        </div>
      </div>

      <!-- Zona de Controles con divisor nítido de 1px -->
      <div class="flex items-center gap-1 shrink-0 border-l border-border-subtle/50 pl-2 ml-1">
        <!-- Botón para reabrir drawer de búsqueda en móvil -->
        <UButton
          icon="i-lucide-search"
          variant="ghost"
          size="xs"
          class="text-primary hover:text-primary/80 md:hidden transform-gpu transition-colors duration-150"
          aria-label="Modificar búsqueda"
          title="Modificar búsqueda"
          @click="emit('openSearch')"
        />
        <UButton
          :icon="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          variant="ghost"
          size="xs"
          class="text-text-muted hover:text-text-main transform-gpu transition-colors duration-150"
          aria-label="Minimizar panel de resultados"
          @click.stop="emit('toggleCollapse')"
        />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          size="xs"
          class="text-text-muted hover:text-text-main transform-gpu transition-colors duration-150"
          aria-label="Cerrar resultados"
          @click="emit('close')"
        />
      </div>
    </div>

    <!-- Zona 2: Telemetría y Contadores (Distancia km/nm, Coordenadas, Conexiones) -->
    <div
      class="flex items-center justify-between gap-2 pt-2 mt-1.5 border-t border-border-subtle/50 text-[10px] text-text-muted w-full overflow-hidden"
    >
      <!-- Par Origen y Destino con cálculo de distancia y coordenadas -->
      <template v-if="selectedOrigin && selectedDestination">
        <div v-if="distanceKm !== null" class="flex items-center gap-1.5 shrink-0">
          <UIcon name="i-lucide-navigation" class="w-3 h-3 text-primary shrink-0" />
          <AnimatedCounter
            :value="distanceKm"
            suffix=" km"
            format-locale
            class="font-semibold text-text-main"
          />
          <AnimatedCounter
            :value="distanceNm ?? 0"
            prefix="("
            suffix=" nm)"
            format-locale
            class="text-text-muted"
          />
        </div>

        <div v-if="distanceKm !== null" class="h-3 w-px bg-border-subtle/60 shrink-0" />

        <div class="truncate font-mono tabular-nums tracking-tight text-[10px] text-text-muted" :title="`Origen: ${formatCoordinates(originAirport?.coordinates)} | Destino: ${formatCoordinates(destinationAirport?.coordinates)}`">
          <span>{{ formatCoordinates(originAirport?.coordinates) }}</span>
        </div>

        <div class="h-3 w-px bg-border-subtle/60 shrink-0" />

        <div class="flex items-center gap-1 shrink-0">
          <span class="font-mono tabular-nums tracking-tight font-bold text-text-main">
            {{ matchingCount }}
          </span>
          <span class="text-text-dim text-[10px]">
            {{ matchingCount === 1 ? 'ruta' : 'rutas' }}
          </span>
        </div>
      </template>

      <!-- Exploración mononodal (Solo Origen o Solo Destino) -->
      <template v-else-if="originAirport || destinationAirport">
        <div class="flex items-center gap-1.5 truncate">
          <UIcon name="i-lucide-map-pin" class="w-3 h-3 text-primary shrink-0" />
          <span class="font-mono tabular-nums tracking-tight text-text-muted truncate">
            {{ formatCoordinates(originAirport?.coordinates || destinationAirport?.coordinates) }}
          </span>
        </div>

        <div class="h-3 w-px bg-border-subtle/60 shrink-0" />

        <div class="flex items-center gap-1 shrink-0">
          <span class="font-mono tabular-nums tracking-tight font-bold text-text-main">
            {{ matchingCount }}
          </span>
          <span class="text-text-dim text-[10px]">
            {{ matchingCount === 1 ? 'conexión' : 'conexiones' }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
