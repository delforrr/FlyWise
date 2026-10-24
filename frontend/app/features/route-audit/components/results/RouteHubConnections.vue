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
  const isOrigin = props.selectedOrigin === route.originId;
  return {
    id: isOrigin ? route.destinationId : route.originId,
    iata: isOrigin ? route.destinationIata : route.originIata,
    city: isOrigin ? route.destinationCity : route.originCity,
    name: isOrigin ? route.destinationName : route.originName,
    hubIata: isOrigin ? route.originIata : route.destinationIata,
  };
}

function handleClick(route: FlightRoute) {
  const dest = getConnectedDestination(route);
  emit("selectDestination", dest.id);
}

const highOtpCount = computed(() => {
  return props.routes.filter((r) => r.averageOtp15 !== null && r.averageOtp15 > 85).length;
});

const delayedOtpCount = computed(() => {
  return props.routes.filter((r) => r.averageOtp15 !== null && r.averageOtp15 <= 85).length;
});

const averageHubOtp = computed(() => {
  // OTP cannot be averaged without operation counts; v1 has no operational data.
  return null;
});

const maxDistanceKm = computed(() => {
  if (props.routes.length === 0) return 0;
  return Math.max(...props.routes.map((r) => r.distanceKm));
});

type SortOption = "otp-desc" | "dist-desc" | "dist-asc" | "city-asc";
const sortBy = ref<SortOption>("otp-desc");

const sortOptions = [
  { label: "Mayor Puntualidad", value: "otp-desc" },
  { label: "Mayor Distancia", value: "dist-desc" },
  { label: "Menor Distancia", value: "dist-asc" },
  { label: "Destino A-Z", value: "city-asc" },
];

const filterTabs = computed(() => {
  const tabs = [
    {
      value: "all",
      label: "Todas",
      badge: props.routes.length,
    },
    {
      value: "high",
      label: "Alta puntualidad",
      badge: highOtpCount.value,
    },
  ];

  if (delayedOtpCount.value > 0) {
    tabs.push({
      value: "delayed",
      label: "Con demoras",
      badge: delayedOtpCount.value,
    });
  }

  return tabs;
});

const filteredRoutes = computed(() => {
  let list = props.routes;

  if (activeFilter.value === "high") {
    list = list.filter((r) => r.averageOtp15 !== null && r.averageOtp15 > 85);
  } else if (activeFilter.value === "delayed") {
    list = list.filter((r) => r.averageOtp15 !== null && r.averageOtp15 <= 85);
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
    sorted.sort((a, b) => (b.averageOtp15 ?? -1) - (a.averageOtp15 ?? -1));
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
  return `Ruta hacia ${dest.city} (${dest.iata}), operada por ${route.primaryAirline}. Distancia ${route.distanceKm.toLocaleString()} kilómetros. Puntualidad ${route.averageOtp15 === null ? "sin datos" : `${route.averageOtp15.toFixed(1)}% OTP-15`}. Presione para aislar y seleccionar como destino.`;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 1. Tarjetas KPI Ejecutivas del Hub con UCard nativo -->
    <div class="grid grid-cols-3 gap-2 font-mono">
      <UCard
        variant="subtle"
        :ui="{
          body: 'p-2 sm:p-2.5 flex flex-col items-center justify-center text-center',
        }"
        class="bg-surface-base/60 dark:bg-surface-elevated/40 border border-border-subtle/50 shadow-xs"
      >
        <span class="text-[9px] uppercase tracking-wider text-text-dim">
          Puntualidad Media
        </span>
        <div class="flex items-center gap-1 mt-0.5">
          <span
            class="size-2 rounded-full shrink-0"
            :class="
              averageHubOtp === null ? 'bg-neutral-400' : (averageHubOtp ?? -1) > 85
                ? 'bg-success'
                : (averageHubOtp ?? -1) >= 60
                  ? 'bg-warning'
                  : 'bg-error'
            "
          />
          <span class="text-xs font-bold font-mono text-text-main tabular-nums">
            {{ averageHubOtp === null ? "Sin datos" : `${averageHubOtp}%` }}
          </span>
        </div>
      </UCard>

      <UCard
        variant="subtle"
        :ui="{
          body: 'p-2 sm:p-2.5 flex flex-col items-center justify-center text-center',
        }"
        class="bg-surface-base/60 dark:bg-surface-elevated/40 border border-border-subtle/50 shadow-xs"
      >
        <span class="text-[9px] uppercase tracking-wider text-text-dim">
          Conexiones
        </span>
        <span
          class="text-xs font-bold font-mono text-primary tabular-nums mt-0.5"
        >
          {{ routes.length }} rutas
        </span>
      </UCard>

      <UCard
        variant="subtle"
        :ui="{
          body: 'p-2 sm:p-2.5 flex flex-col items-center justify-center text-center',
        }"
        class="bg-surface-base/60 dark:bg-surface-elevated/40 border border-border-subtle/50 shadow-xs"
      >
        <span class="text-[9px] uppercase tracking-wider text-text-dim">
          Ruta Más Larga
        </span>
        <span
          class="text-xs font-bold font-mono text-text-main tabular-nums mt-0.5"
        >
          {{ maxDistanceKm.toLocaleString() }} km
        </span>
      </UCard>
    </div>

    <!-- 2. Encabezado con contador y controles de filtrado -->
    <div class="flex flex-col gap-2 pb-2 border-b border-border-subtle/50">
      <!-- Fila Superior: Título / Conteo y badge de acción -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-network" class="w-3.5 h-3.5 text-primary" />
          <span
            class="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-text-dim"
          >
            Rutas Conectadas:
          </span>
          <UBadge
            color="primary"
            variant="subtle"
            size="xs"
            class="font-mono tabular-nums"
          >
            {{ filteredRoutes.length }} / {{ routes.length }}
          </UBadge>
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

      <!-- Pestañas de Filtro Rápido y Selector de Orden con Componentes Nativos -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <!-- Filtros por confiabilidad con UTabs nativo -->
        <UTabs
          v-model="activeFilter"
          :items="filterTabs"
          size="xs"
          class="w-auto"
        />

        <!-- Selector de Ordenamiento Rápido con USelect nativo -->
        <div
          class="flex items-center gap-1.5 text-[10px] font-mono text-text-muted"
        >
          <span class="text-text-dim hidden sm:inline">Orden:</span>
          <USelect
            v-model="sortBy"
            :items="sortOptions"
            value-key="value"
            size="xs"
            class="w-36 font-mono text-xs"
            aria-label="Criterio de ordenamiento"
          />
        </div>
      </div>
    </div>

    <!-- 3. Lista de rutas conectadas o Empty State -->
    <div v-if="filteredRoutes.length > 0" class="flex flex-col gap-2.5">
      <button
        v-for="route in filteredRoutes"
        :key="route.id"
        type="button"
        :aria-label="getAriaLabel(route, getConnectedDestination(route))"
        class="group relative flex flex-col gap-2 p-3 rounded-xl bg-surface-base/60 hover:bg-surface-accent/80 border border-border-subtle/70 hover:border-primary/50 shadow-xs cursor-pointer select-none transform-gpu hover:translate-x-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card w-full text-left"
        @click="handleClick(route)"
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
          <span class="font-normal text-text-muted wrap-break-word">
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
      </button>
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
      <p class="text-[11px] text-text-muted mb-2.5 max-w-55">
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
