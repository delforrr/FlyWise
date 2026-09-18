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
  <div class="double-bezel-shell w-full max-w-xl shadow-2xl">
    <div class="double-bezel-core p-4 sm:p-6 flex flex-col">
      <!-- Encabezado de la Consola de Vuelo -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <h2
            class="font-display font-bold text-xl sm:text-2xl text-text-main tracking-tight"
          >
            Realizá tu Consulta
          </h2>
        </div>
        <p class="text-xs sm:text-sm text-text-muted">
          Seleccioná un Origen y/o Destino para auditar una ruta de preferencia.
          Opcionalmente podés proceder para seleccionarla en el mapa global.
        </p>
      </div>

      <USeparator size="sm" class="my-3 sm:my-4 opacity-75" />

      <!-- Barra de acciones rápidas en Móvil -->
      <div class="flex sm:hidden items-center justify-end gap-2 my-1.5">
        <UButton
          variant="subtle"
          size="xs"
          class="rounded-lg text-primary hover:text-primary hover:bg-surface-accent px-2.5 py-1 gap-1.5 text-xs font-semibold"
          aria-label="Invertir origen y destino"
          @click="swapAirports"
        >
          <UIcon
            name="i-lucide-arrow-up-down"
            class="size-3.5 transition-transform duration-300 shrink-0"
            :style="{ transform: `rotate(${rotation}deg)` }"
          />
          <span>Invertir</span>
        </UButton>

        <UButton
          icon="i-lucide-rotate-ccw"
          variant="subtle"
          size="xs"
          class="rounded-lg text-text-muted hover:text-primary hover:bg-surface-accent px-2.5 py-1 gap-1 text-xs font-medium"
          aria-label="Limpiar selección"
          label="Limpiar"
          @click="clearSelection"
        />
      </div>

      <!-- Módulos de Entrada Origen / Destino -->
      <div class="flex flex-row items-center gap-2 sm:gap-3 my-2 sm:my-3">
        <div class="flex flex-col flex-1 gap-3 min-w-0">
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
                <span
                  class="truncate text-xs sm:text-sm font-medium text-text-main"
                >
                  {{ item.name }}
                  <span class="font-mono font-bold text-primary"
                    >[{{ item.iata }}]</span
                  >
                </span>
              </template>
              <template #item-description="{ item }">
                <span class="text-[11px] sm:text-xs text-text-muted truncate">
                  {{ item.country }}, {{ item.city }}
                </span>
              </template>
            </UInputMenu>
          </InputCard>

          <!-- Boton de invertir -->
          <div class="hidden mt-8 sm:block mx-auto shrink-0">
            <UButton
              variant="subtle"
              size="lg"
              class="rounded-2xl shrink-0 size-11 sm:size-12 text-primary hover:text-primary hover:bg-surface-accent transition-all duration-300 shadow-2xs border border-border-subtle/80 justify-center items-center active:scale-[0.95]"
              aria-label="Invertir origen y destino"
              title="Invertir origen y destino"
              @click="swapAirports"
            >
              <UIcon
                name="i-lucide-arrow-up-down"
                class="size-5 transition-transform duration-300"
                :style="{ transform: `rotate(${rotation}deg)` }"
              />
            </UButton>
          </div>

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
                <span
                  class="truncate text-xs sm:text-sm font-medium text-text-main"
                >
                  {{ item.name }}
                  <span class="font-mono font-bold text-primary"
                    >[{{ item.iata }}]</span
                  >
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
      </div>

      <!-- Botón principal -->
      <div class="mt-4 sm:mt-5">
        <NuxtLink
          to="/explorar"
          class="btn-hud-primary group w-full h-13 sm:h-14 px-5 sm:px-6 rounded-2xl flex items-center justify-between text-base sm:text-lg font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-lg"
        >
          <div class="flex items-center gap-2.5">
            <UIcon name="i-lucide-search" class="size-5 text-white/90" />
            <span v-if="selectedOrigin || selectedDestination"
              >Analizar Ruta</span
            >
            <span v-else>Analizar Rutas Globales</span>
          </div>
        </NuxtLink>
      </div>

      <USeparator size="sm" class="my-3 sm:my-4 opacity-75" />
    </div>
  </div>
</template>
