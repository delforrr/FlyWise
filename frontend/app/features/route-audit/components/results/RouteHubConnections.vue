<script setup lang="ts">
import { computed, ref } from "vue";
import type { FlightRoute } from "~/types/route";

const props = defineProps<{
  selectedOrigin?: string | null;
  routes: FlightRoute[];
}>();

const emit = defineEmits<{
  (e: "selectDestination", iata: string): void;
}>();

type FilterType = "all" | "high" | "delayed";

const activeFilter = ref<FilterType>("all");
const searchQuery = ref("");

function getConnectedDestination(route: FlightRoute) {
  const isOrigin = props.selectedOrigin === route.originIata;
  return {
    iata: isOrigin ? route.destinationIata : route.originIata,
    city: isOrigin ? route.destinationCity : route.originCity,
    name: isOrigin ? route.destinationName : route.originName,
    hubIata: isOrigin ? route.originIata : route.destinationIata,
  };
}

function handleClick(route: FlightRoute) {
  const dest = getConnectedDestination(route);
  emit("selectDestination", dest.iata);
}

const highOtpCount = computed(() => {
  return props.routes.filter((r) => r.averageOtp15 >= 85).length;
});

const delayedOtpCount = computed(() => {
  return props.routes.filter((r) => r.averageOtp15 < 85).length;
});

const filteredRoutes = computed(() => {
  let list = props.routes;

  if (activeFilter.value === "high") {
    list = list.filter((r) => r.averageOtp15 >= 85);
  } else if (activeFilter.value === "delayed") {
    list = list.filter((r) => r.averageOtp15 < 85);
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter((r) => {
      const dest = getConnectedDestination(r);
      return (
        dest.iata.toLowerCase().includes(query) ||
        dest.city.toLowerCase().includes(query) ||
        dest.name.toLowerCase().includes(query) ||
        r.primaryAirline.toLowerCase().includes(query)
      );
    });
  }

  return list;
});

function resetFilters() {
  activeFilter.value = "all";
  searchQuery.value = "";
}

function getAriaLabel(route: FlightRoute, dest: ReturnType<typeof getConnectedDestination>): string {
  return `Ruta hacia ${dest.city} (${dest.iata}), operada por ${route.primaryAirline}. Distancia ${route.distanceKm.toLocaleString()} kilómetros. Puntualidad ${route.averageOtp15.toFixed(1)}% OTP-15. Presione para aislar y seleccionar como destino.`;
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <!-- Encabezado con contador y controles -->
    <div class="flex flex-col gap-2 pb-2 border-b border-border-subtle/50">
      <!-- Fila Superior: Título / Conteo y badge de acción -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-network" class="w-3.5 h-3.5 text-primary" />
          <span class="hud-section-label">
            Rutas Conectadas:
          </span>
          <span class="hud-counter-badge text-[10px]">
            {{ filteredRoutes.length }} / {{ routes.length }}
          </span>
        </div>

        <span class="text-[10px] font-mono text-text-dim">
          Click para aislar
        </span>
      </div>

      <!-- Buscador de destino instantáneo -->
      <div class="relative flex items-center">
        <UIcon
          name="i-lucide-search"
          class="w-3.5 h-3.5 text-text-dim absolute left-2.5 pointer-events-none"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por destino o ciudad..."
          aria-label="Filtrar rutas por destino o ciudad"
          class="w-full text-xs font-mono py-1 pl-8 pr-7 rounded-lg bg-surface-base/60 border border-border-subtle/70 text-text-main placeholder:text-text-dim placeholder:font-sans focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all"
        />
        <button
          v-if="searchQuery"
          type="button"
          aria-label="Limpiar búsqueda"
          class="absolute right-2 text-text-dim hover:text-text-main transition-colors p-0.5 rounded cursor-pointer"
          @click="searchQuery = ''"
        >
          <UIcon name="i-lucide-x" class="w-3 h-3" />
        </button>
      </div>

      <!-- Chips de Filtro Rápido (Todas, Alta puntualidad, Con demoras) -->
      <div class="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtros de rutas conectadas">
        <button
          type="button"
          :aria-pressed="activeFilter === 'all'"
          :class="[
            'px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer inline-flex items-center gap-1 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            activeFilter === 'all'
              ? 'bg-primary text-white font-bold shadow-2xs'
              : 'bg-surface-base/70 text-text-muted hover:text-text-main hover:bg-surface-accent border border-border-subtle/60',
          ]"
          @click="activeFilter = 'all'"
        >
          <span>Todas</span>
          <span
            :class="[
              'text-[9px] tabular-nums px-1 rounded-full',
              activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-surface-accent text-text-dim',
            ]"
          >
            {{ routes.length }}
          </span>
        </button>

        <button
          type="button"
          :aria-pressed="activeFilter === 'high'"
          :class="[
            'px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer inline-flex items-center gap-1 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success',
            activeFilter === 'high'
              ? 'bg-success text-white font-bold shadow-2xs'
              : 'bg-surface-base/70 text-text-muted hover:text-text-main hover:bg-surface-accent border border-border-subtle/60',
          ]"
          @click="activeFilter = 'high'"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="activeFilter === 'high' ? 'bg-white' : 'bg-success'"
          />
          <span>Alta puntualidad</span>
          <span
            :class="[
              'text-[9px] tabular-nums px-1 rounded-full',
              activeFilter === 'high' ? 'bg-white/20 text-white' : 'bg-surface-accent text-text-dim',
            ]"
          >
            {{ highOtpCount }}
          </span>
        </button>

        <button
          v-if="delayedOtpCount > 0"
          type="button"
          :aria-pressed="activeFilter === 'delayed'"
          :class="[
            'px-2 py-0.5 rounded-md text-[10px] font-mono transition-all cursor-pointer inline-flex items-center gap-1 select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning',
            activeFilter === 'delayed'
              ? 'bg-warning text-white font-bold shadow-2xs'
              : 'bg-surface-base/70 text-text-muted hover:text-text-main hover:bg-surface-accent border border-border-subtle/60',
          ]"
          @click="activeFilter = 'delayed'"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="activeFilter === 'delayed' ? 'bg-white' : 'bg-warning'"
          />
          <span>Con demoras</span>
          <span
            :class="[
              'text-[9px] tabular-nums px-1 rounded-full',
              activeFilter === 'delayed' ? 'bg-white/20 text-white' : 'bg-surface-accent text-text-dim',
            ]"
          >
            {{ delayedOtpCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Lista de rutas conectadas o Empty State -->
    <div v-if="filteredRoutes.length > 0" class="flex flex-col gap-1.5">
      <div
        v-for="route in filteredRoutes"
        :key="route.id"
        role="button"
        tabindex="0"
        :aria-label="getAriaLabel(route, getConnectedDestination(route))"
        class="group relative flex items-center justify-between gap-2.5 p-2 rounded-xl bg-surface-base/60 hover:bg-surface-accent/80 border border-border-subtle/70 hover:border-primary/50 shadow-xs cursor-pointer select-none transform-gpu hover:translate-x-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
        @click="handleClick(route)"
        @keydown.enter.prevent="handleClick(route)"
        @keydown.space.prevent="handleClick(route)"
      >
        <!-- Bloque Destino: IATA destacado + Ciudad y Aerolínea -->
        <div class="flex items-center gap-2.5 min-w-0">
          <!-- Badge IATA Destino -->
          <span
            class="inline-flex items-center justify-center min-w-10 h-7.5 px-1.5 rounded-lg font-mono font-bold text-xs tracking-wider bg-surface-accent border border-border-subtle/80 text-text-main group-hover:text-primary group-hover:border-primary/40 transition-colors shadow-2xs shrink-0"
          >
            {{ getConnectedDestination(route).iata }}
          </span>

          <!-- Ciudad y Datos Operacionales -->
          <div class="flex flex-col min-w-0">
            <span class="font-bold text-xs text-text-main group-hover:text-primary transition-colors truncate leading-tight">
              {{ getConnectedDestination(route).city }}
            </span>
            <div class="flex items-center gap-1.5 text-[10px] text-text-muted font-mono truncate mt-0.5">
              <span class="text-text-dim">
                {{ getConnectedDestination(route).hubIata }} ➔ {{ getConnectedDestination(route).iata }}
              </span>
              <span class="text-border-subtle">·</span>
              <span class="truncate font-sans text-text-dim">
                {{ route.primaryAirline }}
              </span>
            </div>
          </div>
        </div>

        <!-- Telemetría: Distancia + Badge OTP-15 + Icono de Avance -->
        <div class="flex items-center gap-2 shrink-0">
          <div class="flex items-center gap-1 font-mono text-[11px] tabular-nums text-text-muted hidden sm:inline-flex">
            <UIcon name="i-lucide-milestone" class="w-3 h-3 text-text-dim shrink-0" />
            <span>{{ route.distanceKm.toLocaleString() }} km</span>
          </div>

          <OtpBadge :value="route.averageOtp15" />

          <UIcon
            name="i-lucide-chevron-right"
            class="w-3.5 h-3.5 text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <!-- Empty State Limpio para Filtros -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-surface-base/30 border border-border-subtle/50"
    >
      <div class="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center text-text-dim mb-2">
        <UIcon name="i-lucide-filter-x" class="w-4 h-4" />
      </div>
      <p class="text-xs font-semibold text-text-main mb-1">
        Sin rutas con los filtros aplicados
      </p>
      <p class="text-[11px] text-text-muted mb-2.5 max-w-[220px]">
        No encontramos conexiones que coincidan con la búsqueda o filtro activo.
      </p>
      <button
        type="button"
        class="text-[11px] font-mono font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none"
        @click="resetFilters"
      >
        <UIcon name="i-lucide-rotate-ccw" class="w-3 h-3" />
        <span>Restablecer filtros</span>
      </button>
    </div>
  </div>
</template>
