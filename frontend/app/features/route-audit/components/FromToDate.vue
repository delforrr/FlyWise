<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { SEED_AIRPORTS } from "~/data/seedData";

interface FromToDateProps {
  hasDate?: boolean;
}

const props = withDefaults(defineProps<FromToDateProps>(), {
  hasDate: false,
});

const {
  selectedOrigin,
  selectedDestination,
  matchingRoutes,
  swapAirports: swapSelection,
  clearSelection,
  triggerFit,
} = useFlightSelection();

// Lista dinámica de códigos IATA de los aeropuertos mock disponibles
const airportItems = computed(() => {
  return SEED_AIRPORTS.map((a) => a.iata);
});

const defaultDate = shallowRef<DateValue>(today(getLocalTimeZone()));
const rotation = ref(0);

function swapAirports() {
  swapSelection();
  rotation.value += 180;
}

function handleSearch() {
  triggerFit();
}
</script>

<template>
  <HudPill class="gap-1.5 sm:gap-2 flex-nowrap items-center shrink-0">
    <!-- Selector Origen -->
    <UInputMenu
      arrow
      v-model="selectedOrigin"
      variant="soft"
      :items="airportItems"
      placeholder="Origen"
      icon="i-lucide-plane-takeoff"
      size="sm"
      class="hud-custom-input w-28 sm:w-36 shrink-0 font-mono font-semibold"
    />

    <!-- Botón Intercambiar Origen / Destino -->
    <UButton
      icon="i-lucide-arrow-left-right"
      variant="ghost"
      size="xs"
      class="rounded-full shrink-0 text-aero-cyan/80 hover:text-aero-cyan hover:bg-surface-card transition-transform"
      :style="{ transform: `rotate(${rotation}deg)` }"
      aria-label="Invertir origen y destino"
      @click="swapAirports"
    />

    <!-- Selector Destino -->
    <UInputMenu
      arrow
      v-model="selectedDestination"
      :items="airportItems"
      variant="soft"
      placeholder="Destino"
      icon="i-lucide-plane-landing"
      size="sm"
      class="hud-custom-input w-28 sm:w-36 shrink-0 font-mono font-semibold"
    />

    <USeparator
      v-if="hasDate"
      orientation="vertical"
      class="h-4 hidden sm:block shrink-0"
      size="sm"
    />

    <!-- Selector de Fecha (Desktop) -->
    <div v-if="hasDate" class="hidden md:flex items-center shrink-0">
      <UPopover arrow>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-calendar"
          :label="defaultDate.toString()"
          class="font-mono text-xs text-text-muted hover:text-text-main h-8 sm:h-9"
          aria-label="Seleccionar fecha de vuelo"
        />

        <template #content>
          <UCalendar v-model="defaultDate" class="p-2" />
        </template>
      </UPopover>
    </div>

    <USeparator
      v-if="selectedOrigin || selectedDestination"
      orientation="vertical"
      class="h-4 hidden sm:block shrink-0 mx-3"
      size="sm"
    />

    <!-- Contador de Rutas Coincidentes (si hay filtro activo) -->
    <RouteCounterBadge
      v-if="selectedOrigin || selectedDestination"
      :count="matchingRoutes.length"
    />

    <!-- Botón de Búsqueda / Encuadre HUD -->
    <UButton
      icon="i-lucide-locate"
      size="sm"
      class="btn-hud-primary rounded-xl shrink-0 px-2.5 sm:px-3 shadow-md"
      aria-label="Buscar vuelo y centrar cámara"
      @click="handleSearch"
    />

    <!-- Botón Reset si hay selección -->
    <UButton
      v-if="selectedOrigin || selectedDestination"
      icon="i-lucide-rotate-ccw"
      variant="ghost"
      size="xs"
      class="text-text-muted hover:text-text-main rounded-full shrink-0"
      title="Restablecer búsqueda"
      aria-label="Restablecer filtros"
      @click="clearSelection"
    />
  </HudPill>
</template>
