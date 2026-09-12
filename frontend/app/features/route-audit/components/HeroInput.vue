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
  swapAirports: swapSelection,
  clearSelection,
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
</script>

<template>
  <UPageCard spotlight class="w-full max-w-xl p-4">
    <div>
      <h1 class="hud-secondary-title text-2xl">Realizá tu consulta</h1>
      <p class="text-text-muted hidden sm:block">
        Seleccioná un Origen y opcionalmente un Destino para comenzar
      </p>
    </div>

    <USeparator size="sm" class="mt-2" />

    <div class="flex items-center gap-2 my-5">
      <div class="flex flex-col flex-1 gap-3">
        <div class="input-card p-5">
          <div class="input-iata p-3">{{ selectedOrigin || "-" }}</div>
          <UInputMenu
            mode="autocomplete"
            size="xl"
            class="w-full flex-1"
            :trailing-icon="false"
            variant="ghost"
            placeholder="Aeropuerto, código IATA, País o Ciudad"
          />
        </div>
        
        <div class="input-card p-5">
          <div class="input-iata">{{ selectedDestination || "-" }}</div>
          <UInputMenu
            mode="autocomplete"
            size="xl"
            class="w-full flex-1"
            :trailing-icon="false"
            variant="ghost"
            placeholder="Aeropuerto, código IATA, País o Ciudad"
          />
        </div>
      </div>

      <UButton
        icon="i-lucide-arrow-up-down"
        variant="subtle"
        size="xl"
        class="rounded-full shrink-0 text-primary/80 hover:text-primary hover:bg-surface-card transition-transform"
        :style="{ transform: `rotate(${rotation}deg)` }"
        aria-label="Invertir origen y destino"
        @click="swapAirports"
      />
    </div>

    <UButton
      loading-auto
      to="map"
      size="xl"
      label="Analizar"
      trailing-icon="i-lucide-arrow-right"
      leading-icon="i-lucide-search"
      class="btn-hud-primary rounded-xl shadow-md text-2xl h-15 justify-center"
      :ui="{
        leadingIcon: 'mr-2',
      }"
    />
  </UPageCard>
</template>
