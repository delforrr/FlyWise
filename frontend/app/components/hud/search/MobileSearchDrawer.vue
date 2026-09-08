<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { SEED_AIRPORTS } from "~/data/seedData";
import RouteCounterBadge from "./RouteCounterBadge.vue";

const {
  selectedOrigin,
  selectedDestination,
  matchingRoutes,
  isMobileSearchOpen,
  openMobileSearch,
  closeMobileSearch,
  swapAirports: swapSelection,
  clearSelection,
  triggerFit,
} = useFlightSelection();

const airportItems = computed(() => SEED_AIRPORTS.map((a) => a.iata));

const defaultDate = shallowRef<DateValue>(today(getLocalTimeZone()));
const rotation = ref(0);

const quickHubs = [
  { iata: "EZE", city: "Buenos Aires" },
  { iata: "COR", city: "Córdoba" },
  { iata: "MDZ", city: "Mendoza" },
  { iata: "BRC", city: "Bariloche" },
  { iata: "MAD", city: "Madrid" },
  { iata: "MIA", city: "Miami" },
  { iata: "SCL", city: "Santiago" },
  { iata: "GRU", city: "São Paulo" },
];

function swapAirports() {
  swapSelection();
  rotation.value += 180;
}

function handleSelectHub(iata: string) {
  if (!selectedOrigin.value) {
    selectedOrigin.value = iata;
  } else if (!selectedDestination.value && selectedOrigin.value !== iata) {
    selectedDestination.value = iata;
  } else {
    selectedOrigin.value = iata;
  }
}

function handleSearch() {
  closeMobileSearch();
  nextTick(() => {
    triggerFit();
  });
}
</script>

<template>
  <div>
    <!-- 1. Cápsula de búsqueda flotante en móvil (visible solo cuando NO hay selección activa) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-6 scale-95"
      leave-to-class="opacity-0 translate-y-6 scale-95"
    >
      <div
        v-if="!selectedOrigin && !selectedDestination"
        class="fixed bottom-4 inset-x-4 z-30 md:hidden pointer-events-auto select-none"
      >
        <button
          type="button"
          class="w-full hud-card border border-border-subtle/80 bg-surface-elevated/90 backdrop-blur-xl shadow-2xl p-3.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98]"
          aria-label="Abrir búsqueda de vuelos"
          @click="openMobileSearch"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-9 h-9 rounded-xl bg-aero-cyan/15 border border-aero-cyan/30 flex items-center justify-center shrink-0 text-aero-cyan"
            >
              <UIcon name="i-lucide-search" class="w-5 h-5" />
            </div>
            <div class="truncate">
              <span class="block text-xs font-semibold text-text-main truncate">
                ¿A dónde querés volar?
              </span>
              <span class="block text-[11px] text-text-muted truncate">
                Buscar origen, destino o hubs
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <UBadge
              variant="subtle"
              size="xs"
              class="rounded-lg text-[10px] font-mono font-medium px-2 py-0.5"
            >
              Filtros
            </UBadge>
            <UIcon name="i-lucide-chevron-up" class="w-4 h-4 text-text-muted" />
          </div>
        </button>
      </div>
    </Transition>

    <!-- 2. Drawer Vaul desde abajo con snap-points: 460px y full screen (1) -->
    <UDrawer
      v-model:open="isMobileSearchOpen"
      direction="bottom"
      :snap-points="['460px', 1]"
      :handle="true"
      title="Buscar Vuelo"
      description="Auditoría de puntualidad histórica y conexiones"
      class="md:hidden"
    >
      <template #body>
        <div class="flex flex-col gap-4 pb-2">
          <!-- Título y Reset -->
          <div class="flex items-center justify-between pt-1">
            <div>
              <h2 class="text-base font-bold text-text-main">
                Buscar Ruta y Puntualidad
              </h2>
              <p class="text-xs text-text-muted">
                Puntualidad OTP-15 y conexiones aéreas
              </p>
            </div>
            <UButton
              v-if="selectedOrigin || selectedDestination"
              icon="i-lucide-rotate-ccw"
              variant="ghost"
              size="xs"
              label="Limpiar"
              class="text-text-muted hover:text-text-main"
              @click="clearSelection"
            />
          </div>

          <!-- Selectores Origen y Destino -->
          <div class="flex flex-col gap-2.5">
            <div>
              <label
                class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1"
              >
                Aeropuerto de Origen
                <UInputMenu
                  arrow
                  v-model="selectedOrigin"
                  :items="airportItems"
                  variant="soft"
                  placeholder="Seleccionar origen (ej. EZE)"
                  icon="i-lucide-plane-takeoff"
                  size="lg"
                  class="hud-custom-input w-full font-mono font-semibold"
                />
              </label>
            </div>

            <!-- Botón Swap Centrado -->
            <div class="flex items-center justify-center -my-1">
              <UButton
                icon="i-lucide-arrow-up-down"
                variant="ghost"
                size="sm"
                class="rounded-full text-aero-cyan hover:bg-surface-card transition-transform border border-border-subtle/50"
                :style="{ transform: `rotate(${rotation}deg)` }"
                aria-label="Invertir origen y destino"
                @click="swapAirports"
              />
            </div>

            <div>
              <label
                class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1"
              >
                Aeropuerto de Destino
                <UInputMenu
                  arrow
                  v-model="selectedDestination"
                  :items="airportItems"
                  variant="soft"
                  placeholder="Seleccionar destino (ej. MAD)"
                  icon="i-lucide-plane-landing"
                  size="lg"
                  class="hud-custom-input w-full font-mono font-semibold"
                />
              </label>
            </div>
          </div>

          <!-- Hubs Sugeridos Rápidos -->
          <div class="flex flex-col gap-1.5">
            <span
              class="text-[11px] font-semibold text-text-muted uppercase tracking-wider"
            >
              Hubs Populares
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="hub in quickHubs"
                :key="hub.iata"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all border"
                :class="[
                  selectedOrigin === hub.iata ||
                  selectedDestination === hub.iata
                    ? 'bg-aero-cyan text-white border-aero-cyan shadow-sm'
                    : 'bg-surface-base text-text-muted hover:text-text-main border-border-subtle hover:border-aero-cyan/40',
                ]"
                @click="handleSelectHub(hub.iata)"
              >
                {{ hub.iata }}
                <span class="text-[10px] font-sans opacity-70 font-normal">
                  {{ hub.city }}
                </span>
              </button>
            </div>
          </div>

          <!-- Selector de Fecha (Calendario visible al scrollear hacia arriba) -->
          <div
            class="flex flex-col gap-1.5 pt-2 border-t border-border-subtle/60"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-[11px] font-semibold text-text-muted uppercase tracking-wider"
              >
                Fecha del Vuelo
              </span>
              <span class="text-xs font-mono text-text-muted">
                {{ defaultDate.toString() }}
              </span>
            </div>
            <div
              class="flex justify-center bg-surface-base/50 rounded-xl p-2 border border-border-subtle/50"
            >
              <UCalendar v-model="defaultDate" class="w-full justify-center" />
            </div>
          </div>
        </div>
      </template>

      <!-- Footer con CTA principal -->
      <template #footer>
        <div class="flex items-center gap-2 w-full pt-1">
          <RouteCounterBadge
            v-if="selectedOrigin || selectedDestination"
            :count="matchingRoutes.length"
          />
          <UButton
            icon="i-lucide-search"
            block
            size="lg"
            class="btn-hud-primary flex-1 h-12 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center"
            label="Auditar Vuelo y Ver Mapa"
            @click="handleSearch"
          />
        </div>
      </template>
    </UDrawer>
  </div>
</template>
