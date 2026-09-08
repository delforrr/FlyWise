<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { SEED_AIRPORTS } from "~/data/seedData";

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
const inputDate = useTemplateRef("inputDate");
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
      :ui="{
        base: 'w-full h-8 sm:h-9 leading-none',
        root: 'shrink-0',
      }"
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
      :ui="{
        base: 'w-full h-8 sm:h-9 leading-none',
        root: 'shrink-0',
      }"
    />

    <USeparator orientation="vertical" class="h-4 hidden sm:block shrink-0" size="sm" />

    <!-- Input de Fecha (Desktop) -->
    <div class="hidden md:block shrink-0">
      <UInputDate
        ref="inputDate"
        v-model="defaultDate"
        size="sm"
        variant="ghost"
        :ui="{ base: 'h-8 sm:h-9' }"
      >
        <template #leading>
          <UPopover arrow :reference="inputDate?.inputsRef[3]?.$el">
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              icon="i-lucide-calendar"
              aria-label="Select a date"
              class="w-10"
            />

            <template #content>
              <UCalendar v-model="defaultDate" class="p-2" />
            </template>
          </UPopover>
        </template>
      </UInputDate>
    </div>

    <!-- Contador de Rutas Coincidentes (si hay filtro activo) -->
    <div
      v-if="selectedOrigin || selectedDestination"
      class="hidden lg:flex items-center gap-1 text-[11px] font-mono text-aero-cyan bg-aero-cyan/10 px-2 py-1 rounded-md border border-aero-cyan/20 shrink-0"
      :title="`${matchingRoutes.length} rutas coinciden con tu búsqueda`"
    >
      <UIcon name="i-lucide-route" class="w-3.5 h-3.5" />
      <span>{{ matchingRoutes.length }}</span>
    </div>

    <!-- Botón de Búsqueda / Encuadre HUD -->
    <UButton
      icon="i-lucide-search"
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
