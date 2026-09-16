<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { SEED_AIRPORTS, SEED_AIRPORTS_BY_IATA } from "~/data/seedData";

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

const {
  selectedOrigin,
  selectedDestination,
  swapAirports: swapSelection,
  clearSelection,
} = useFlightSelection();

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
  return SEED_AIRPORTS_BY_IATA.get(selectedDestination.value.toUpperCase()) ?? null;
});

const defaultDate = shallowRef<DateValue>(today(getLocalTimeZone()));
const rotation = ref(0);

function swapAirports() {
  swapSelection();
  rotation.value += 180;
}
</script>

<template>
  <UPageCard spotlight class="w-full max-w-xl p-4 sm:p-6 hud-panel border border-border-subtle shadow-2xl">
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <h2 class="hud-secondary-title text-xl sm:text-2xl text-text-main">
          Realizá tu consulta
        </h2>
        <span class="hud-counter-badge text-[10px] sm:text-xs">
          <UIcon name="i-lucide-sparkles" class="size-3" />
          Audit
        </span>
      </div>
      <p class="text-xs sm:text-sm text-text-muted">
        Seleccioná un Origen y opcionalmente un Destino para comenzar
      </p>
    </div>

    <USeparator size="sm" class="my-3 sm:my-4" />

    <div class="flex flex-row items-center gap-2 sm:gap-3 my-2 sm:my-4">
      <div class="flex flex-col flex-1 gap-3 sm:gap-4 min-w-0">
        <InputCard
          type="origin"
          :iata="selectedOrigin"
          :airport="originAirport"
        >
          <UInputMenu
            v-model="selectedOrigin"
            :items="airportItems"
            value-key="value"
            label-key="label"
            :filter-fields="['iata', 'name', 'city', 'country']"
            size="xl"
            class="w-full flex-1 input-ghost"
            :trailing-icon="false"
            variant="ghost"
            placeholder="Desde: Aeropuerto, IATA o Ciudad"
            :ui="{
              base: 'bg-transparent! hover:bg-transparent! focus:bg-transparent! active:bg-transparent! border-0! ring-0! shadow-none! focus-visible:ring-0! text-text-main font-semibold text-sm sm:text-base px-1 sm:px-2.5',
            }"
          >
            <template #item-label="{ item }">
              <span class="truncate text-xs sm:text-sm">
                {{ item.name }}
                <span class="font-mono font-bold text-primary">[{{ item.iata }}]</span>
              </span>
            </template>
            <template #item-description="{ item }">
              <span class="text-[11px] sm:text-xs text-text-muted truncate">
                {{ item.country }}, {{ item.city }}
              </span>
            </template>
          </UInputMenu>
        </InputCard>

        <InputCard
          type="destination"
          :iata="selectedDestination"
          :airport="destinationAirport"
        >
          <UInputMenu
            v-model="selectedDestination"
            :items="airportItems"
            value-key="value"
            label-key="label"
            :filter-fields="['iata', 'name', 'city', 'country']"
            size="xl"
            class="w-full flex-1 input-ghost"
            :trailing-icon="false"
            variant="ghost"
            placeholder="Hacia: Aeropuerto, IATA o Ciudad"
            :ui="{
              base: 'bg-transparent! hover:bg-transparent! focus:bg-transparent! active:bg-transparent! border-0! ring-0! shadow-none! focus-visible:ring-0! text-text-main font-semibold text-sm sm:text-base px-1 sm:px-2.5',
            }"
          >
            <template #item-label="{ item }">
              <span class="truncate text-xs sm:text-sm">
                {{ item.name }}
                <span class="font-mono font-bold text-primary">[{{ item.iata }}]</span>
              </span>
            </template>
            <template #item-description="{ item }">
              <span class="text-[11px] sm:text-xs text-text-muted truncate">
                {{ item.country }}, {{ item.city }}
              </span>
            </template>
          </UInputMenu>
        </InputCard>
      </div>

      <div class="flex flex-col gap-2 sm:gap-3 shrink-0">
        <UButton
          icon="i-lucide-arrow-up-down"
          variant="subtle"
          size="lg"
          class="rounded-full shrink-0 size-11 sm:size-12 text-primary/80 hover:text-primary hover:bg-surface-card transition-all duration-300 shadow-xs"
          :style="{ transform: `rotate(${rotation}deg)` }"
          aria-label="Invertir origen y destino"
          title="Invertir origen y destino"
          @click="swapAirports"
        />

        <UButton
          icon="i-lucide-rotate-ccw"
          variant="subtle"
          size="lg"
          class="rounded-full shrink-0 size-11 sm:size-12 text-text-muted hover:text-primary hover:bg-surface-card transition-all shadow-xs"
          aria-label="Limpiar selección"
          title="Limpiar campos"
          @click="clearSelection"
        />
      </div>
    </div>

    <div class="mt-4 sm:mt-6">
      <UButton
        loading-auto
        to="/explorar"
        size="xl"
        label="Analizar Rutas"
        trailing-icon="i-lucide-arrow-right"
        leading-icon="i-lucide-search"
        class="btn-hud-primary w-full rounded-xl shadow-lg text-lg sm:text-xl h-13 sm:h-14 justify-center font-semibold"
      />
    </div>
  </UPageCard>
</template>
