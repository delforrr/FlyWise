<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { SEED_AIRPORTS, SEED_AIRPORTS_BY_IATA } from "~/data/seedData";

const {
  selectedOrigin,
  selectedDestination,
  swapAirports: swapSelection,
  clearSelection,
} = useFlightSelection();

interface AirportMenuItem {
  id: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  label: string;
  description: string;
  value: string;
}

// Lista enriquecida para búsqueda multicriterio (código IATA, nombre, ciudad y país)
const airportItems = computed<AirportMenuItem[]>(() => {
  return SEED_AIRPORTS.map((a) => ({
    id: a.id,
    iata: a.iata,
    name: a.name,
    city: a.city,
    country: a.country,
    label: `${a.name} [${a.iata}]`,
    description: `${a.country}, ${a.city}`,
    value: a.iata,
  }));
});

const originAirport = computed(() => {
  if (!selectedOrigin.value) return null;
  return SEED_AIRPORTS_BY_IATA.get(selectedOrigin.value.toUpperCase()) ?? null;
});

const destinationAirport = computed(() => {
  if (!selectedDestination.value) return null;
  return (
    SEED_AIRPORTS_BY_IATA.get(selectedDestination.value.toUpperCase()) ?? null
  );
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
        <div class="input-card p-5 items-center gap-3">
          <div
            v-if="selectedOrigin"
            class="input-iata p-3 flex items-center justify-center font-mono font-bold shrink-0"
          >
            {{ selectedOrigin }}
          </div>
          <div class="flex flex-col flex-1 min-w-0">
            <UInputMenu
              v-model="selectedOrigin"
              :items="airportItems"
              value-key="value"
              label-key="label"
              :filter-fields="['iata', 'name', 'city', 'country']"
              size="xl"
              class="w-full flex-1"
              :trailing-icon="false"
              variant="ghost"
              placeholder="Aeropuerto, código IATA, País o Ciudad"
            >
              <template #item-label="{ item }">
                <span class="truncate">
                  {{ item.name }}
                  <span class="font-mono font-bold text-primary"
                    >[{{ item.iata }}]</span
                  >
                </span>
              </template>
              <template #item-description="{ item }">
                <span class="text-xs text-text-muted truncate">
                  {{ item.country }}, {{ item.city }}
                </span>
              </template>
            </UInputMenu>
            <p
              v-if="originAirport"
              class="text-xs text-text-muted px-2.5 truncate"
            >
              {{ originAirport.city }}, {{ originAirport.country }}
            </p>
          </div>
        </div>

        <div class="input-card p-5 items-center gap-3">
          <div
            v-if="selectedDestination"
            class="input-iata p-3 flex items-center justify-center font-mono font-bold shrink-0"
          >
            {{ selectedDestination }}
          </div>
          <div class="flex flex-col flex-1 min-w-0">
            <UInputMenu
              v-model="selectedDestination"
              :items="airportItems"
              value-key="value"
              label-key="label"
              :filter-fields="['iata', 'name', 'city', 'country']"
              size="xl"
              class="w-full flex-1"
              :trailing-icon="false"
              variant="ghost"
              placeholder="Aeropuerto, código IATA, País o Ciudad"
            >
              <template #item-label="{ item }">
                <span class="truncate">
                  {{ item.name }}
                  <span class="font-mono font-bold text-primary"
                    >[{{ item.iata }}]</span
                  >
                </span>
              </template>
              <template #item-description="{ item }">
                <span class="text-xs text-text-muted truncate">
                  {{ item.country }}, {{ item.city }}
                </span>
              </template>
            </UInputMenu>
            <p
              v-if="destinationAirport"
              class="text-xs text-text-muted px-2.5 truncate"
            >
              {{ destinationAirport.city }}, {{ destinationAirport.country }}
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <UButton
          icon="i-lucide-arrow-up-down"
          variant="subtle"
          size="xl"
          class="rounded-full shrink-0 text-primary/80 hover:text-primary hover:bg-surface-card transition-transform"
          :style="{ transform: `rotate(${rotation}deg)` }"
          aria-label="Invertir origen y destino"
          @click="swapAirports"
        />

        <UButton
          icon="i-lucide-rotate-ccw"
          variant="subtle"
          size="xl"
          class="rounded-full shrink-0 text-muted/80 hover:text-primary hover:bg-surface-card"
          aria-label="Invertir origen y destino"
          @click="clearSelection"
        />
      </div>
    </div>

    <UButton
      loading-auto
      to="explorar"
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
