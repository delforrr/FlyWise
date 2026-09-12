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
  <UPageCard spotlight class="w-full max-w-xl p-4">
    <div>
      <h1 class="hud-secondary-title text-2xl">Realizá tu consulta</h1>
      <p class="text-text-muted hidden sm:block">
        Seleccioná un Origen y opcionalmente un Destino para comenzar
      </p>
    </div>

    <USeparator size="sm" />

    <UInputMenu size="xl" variant="soft" />
  </UPageCard>
</template>
