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

const averageHubOtp = computed(() => {
  if (props.routes.length === 0) return 0;
  const sum = props.routes.reduce((acc, r) => acc + r.averageOtp15, 0);
  return Number((sum / props.routes.length).toFixed(1));
});

const maxDistanceKm = computed(() => {
  if (props.routes.length === 0) return 0;
  return Math.max(...props.routes.map((r) => r.distanceKm));
});

type SortOption = "otp-desc" | "dist-desc" | "dist-asc" | "city-asc";
const sortBy = ref<SortOption>("otp-desc");

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

  const sorted = [...list];
  if (sortBy.value === "otp-desc") {
    sorted.sort((a, b) => b.averageOtp15 - a.averageOtp15);
  } else if (sortBy.value === "dist-desc") {
    sorted.sort((a, b) => b.distanceKm - a.distanceKm);
  } else if (sortBy.value === "dist-asc") {
    sorted.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (sortBy.value === "city-asc") {
    sorted.sort((a, b) => {
      const da = getConnectedDestination(a);
      const db = getConnectedDestination(b);
      return da.city.localeCompare(db.city);
    });
  }

  return sorted;
});

function resetFilters() {
  activeFilter.value = "all";
  searchQuery.value = "";
  sortBy.value = "otp-desc";
}

function getAriaLabel(
  route: FlightRoute,
  dest: ReturnType<typeof getConnectedDestination>,
): string {
  return `Ruta hacia ${dest.city} (${dest.iata}), operada por ${route.primaryAirline}. Distancia ${route.distanceKm.toLocaleString()} kilómetros. Puntualidad ${route.averageOtp15.toFixed(1)}% OTP-15. Presione para aislar y seleccionar como destino.`;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 1. Tarjetas KPI Ejecutivas del Hub -->
    <div
      class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-surface-base/60 dark:bg-surface-elevated/40 border border-border-subtle/50 text-center font-mono"
    >
      <div class="flex flex-col items-center justify-center p-1">
        <span class="text-[9px] uppercase tracking-wider text-text-dim"
          >Puntualidad Media</span
        >
        <div class="flex items-center gap-1 mt-0.5">
          <span
            class="size-2 rounded-full shrink-0"
            :class="
              averageHubOtp >= 85
                ? 'bg-success'
                : averageHubOtp >= 60
                  ? 'bg-warning'
                  : 'bg-error'
            "
          />
          <span class="text-xs font-bold font-mono text-text-main tabular-nums">
            {{ averageHubOtp }}%
          </span>
        </div>
      </div>

      <div
        class="flex flex-col items-center justify-center p-1 border-x border-border-subtle/50"
      >
        <span class="text-[9px] uppercase tracking-wider text-text-dim"
          >Conexiones</span
        >
        <span
          class="text-xs font-bold font-mono text-primary tabular-nums mt-0.5"
        >
          {{ routes.length }} rutas
        </span>
      </div>

      <div class="flex flex-col items-center justify-center p-1">
        <span class="text-[9px] uppercase tracking-wider text-text-dim"
          >Ruta Más Larga</span
        >
        <span
          class="text-xs font-bold font-mono text-text-main tabular-nums mt-0.5"
        >
          {{ maxDistanceKm.toLocaleString() }} km
        </span>
      </div>
    </div>

    <!-- 2. Encabezado con contador y controles de filtrado -->
    <div class="flex flex-col gap-2 pb-2 border-b border-border-subtle/50">
      <!-- Fila Superior: Título / Conteo y badge de acción -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-network" class="w-3.5 h-3.5 text-primary" />
          <span class="hud-section-label"> Rutas Conectadas: </span>
          <span class="hud-counter-badge text-[10px]">
            {{ filteredRoutes.length }} / {{ routes.length }}
          </span>
        </div>

        <span class="text-[10px] font-mono text-text-dim">
          Click para auditar
        </span>
      </div>

      <!-- Buscador de destino instantáneo con UInput de Nuxt UI -->
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Buscar por destino, ciudad o aerolínea..."
        aria-label="Filtrar rutas por destino, ciudad o aerolínea"
        size="xs"
        class="w-full font-mono text-xs"
      >
        <template v-if="searchQuery" #trailing>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            size="xs"
            aria-label="Limpiar búsqueda"
            class="text-text-dim hover:text-text-main p-0.5 cursor-pointer"
            @click="searchQuery = ''"
          />
        </template>
      </UInput>

      <!-- Chips de Filtro Rápido y Selector de Orden -->
      <div class="flex items-center justify-between gap-1.5 flex-wrap">
        <!-- Filtros por confiabilidad -->
        <div
          class="flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label="Filtros de rutas conectadas"
        >
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
                activeFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-accent text-text-dim',
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
                activeFilter === 'high'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-accent text-text-dim',
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
                activeFilter === 'delayed'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-accent text-text-dim',
              ]"
            >
              {{ delayedOtpCount }}
            </span>
          </button>
        </div>

        <!-- Selector de Ordenamiento Rápido -->
        <div
          class="flex items-center gap-1 text-[10px] font-mono text-text-muted"
        >
          <span class="text-text-dim hidden sm:inline">Orden:</span>
          <select
            v-model="sortBy"
            class="bg-surface-base/80 border border-border-subtle/60 rounded px-1.5 py-0.5 text-[10px] font-mono text-text-main focus:outline-none focus:border-primary cursor-pointer"
            aria-label="Criterio de ordenamiento"
          >
            <option value="otp-desc">Mayor Puntualidad</option>
            <option value="dist-desc">Mayor Distancia</option>
            <option value="dist-asc">Menor Distancia</option>
            <option value="city-asc">Destino A-Z</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 3. Lista de rutas conectadas o Empty State -->
    <div v-if="filteredRoutes.length > 0" class="flex flex-col gap-2.5">
      <div
        v-for="route in filteredRoutes"
        :key="route.id"
        role="button"
        tabindex="0"
        :aria-label="getAriaLabel(route, getConnectedDestination(route))"
        class="group relative flex flex-col gap-2 p-3 rounded-xl bg-surface-base/60 hover:bg-surface-accent/80 border border-border-subtle/70 hover:border-primary/50 shadow-xs cursor-pointer select-none transform-gpu hover:translate-x-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
        @click="handleClick(route)"
        @keydown.enter.prevent="handleClick(route)"
        @keydown.space.prevent="handleClick(route)"
      >
        <!-- Fila 1: IATA Badge + Ciudad Destino (izquierda) y OTP Badge + Chevron (derecha) -->
        <div class="flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="inline-flex items-center justify-center min-w-10 h-7.5 px-2 rounded-lg font-mono font-bold text-xs tracking-wider bg-surface-accent border border-border-subtle/80 text-text-main group-hover:text-primary group-hover:border-primary/40 transition-colors shadow-2xs shrink-0"
            >
              {{ getConnectedDestination(route).iata }}
            </span>
            <span
              class="font-bold text-sm text-text-main group-hover:text-primary transition-colors leading-tight"
            >
              {{ getConnectedDestination(route).city }}
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <OtpBadge :value="route.averageOtp15" />
            <UIcon
              name="i-lucide-chevron-right"
              class="w-4 h-4 text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
              aria-hidden="true"
            />
          </div>
        </div>

        <!-- Fila 2: Nombre Completo del Aeropuerto de Destino (sin truncar) -->
        <div
          v-if="getConnectedDestination(route).name"
          class="flex items-center gap-1.5 text-xs text-text-dim leading-snug"
        >
          <UIcon
            name="i-lucide-building-2"
            class="w-3.5 h-3.5 text-text-dim shrink-0"
          />
          <span class="font-normal text-text-muted break-words">
            {{ getConnectedDestination(route).name }}
          </span>
        </div>

        <!-- Fila 3: Datos Operacionales (Tramo + Aerolínea Completa + Distancia) -->
        <div
          class="flex items-center justify-between gap-2 pt-1.5 border-t border-border-subtle/40 text-[11px] font-mono text-text-muted flex-wrap"
        >
          <div class="flex items-center gap-1.5 flex-wrap min-w-0">
            <span class="text-text-dim font-bold">
              {{ getConnectedDestination(route).hubIata }} ➔
              {{ getConnectedDestination(route).iata }}
            </span>
            <span class="text-border-subtle">·</span>
            <span class="font-semibold text-text-main">
              {{ route.primaryAirline }}
            </span>
            <template v-if="route.airlines?.length > 1">
              <span
                class="text-[9px] px-1.5 py-0.5 rounded bg-surface-accent text-text-dim border border-border-subtle/50 font-sans"
              >
                +{{ route.airlines.length - 1 }} aerolínea{{
                  route.airlines.length > 2 ? "s" : ""
                }}
              </span>
            </template>
          </div>

          <div
            class="flex items-center gap-1 font-mono text-[11px] tabular-nums text-text-muted shrink-0"
            title="Distancia ortodrómica"
          >
            <UIcon
              name="i-lucide-milestone"
              class="w-3.5 h-3.5 text-text-dim shrink-0"
            />
            <span>{{ route.distanceKm.toLocaleString() }} km</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State Limpio para Filtros -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl bg-surface-base/30 border border-border-subtle/50"
    >
      <div
        class="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center text-text-dim mb-2"
      >
        <UIcon name="i-lucide-filter-x" class="w-4 h-4" />
      </div>
      <p class="text-xs font-semibold text-text-main mb-1">
        Sin rutas con los filtros aplicados
      </p>
      <p class="text-[11px] text-text-muted mb-2.5 max-w-[220px]">
        No encontramos conexiones que coincidan con la búsqueda o filtro activo.
      </p>
      <UButton
        icon="i-lucide-rotate-ccw"
        variant="link"
        size="xs"
        label="Restablecer filtros"
        class="text-[11px] font-mono font-medium text-primary hover:underline p-0 cursor-pointer"
        @click="resetFilters"
      />
    </div>
  </div>
</template>
