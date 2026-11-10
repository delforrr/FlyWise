<script setup lang="ts">
import { useRouteMetrics } from '../../composables/useRouteMetrics';

const { filtro, opciones, cargandoOpciones, errorOpciones, cargando, error, cargarOpciones, actualizar } = useRouteMetrics();
onMounted(() => { void cargarOpciones(); });
</script>

<template>
  <UPopover :content="{ side: 'left', align: 'start', sideOffset: 12 }" portal>
    <UButton
      icon="i-lucide-calendar-days"
      color="neutral"
      variant="ghost"
      :title="filtro.periodo ? `Puntualidad · ${filtro.periodo}` : 'Puntualidad'"
      aria-label="Filtrar puntualidad"
      class="size-10 justify-center rounded-xl p-0"
    />
    <template #content>
      <section class="w-60 max-w-[calc(100vw-5rem)] space-y-3 p-3 text-sm" aria-label="Puntualidad de rutas">
        <h2 class="font-semibold text-text-main">Puntualidad de rutas</h2>
        <label class="block space-y-1">
          <span class="text-text-muted">Mes observado</span>
          <select
            v-model="filtro.periodo"
            aria-label="Mes observado"
            class="block min-h-11 w-full rounded-md border border-border-subtle bg-surface-card px-2 text-text-main"
            :disabled="!opciones?.periodos.length"
          >
            <option value="" disabled>Seleccioná un mes</option>
            <option v-for="mes in opciones?.periodos" :key="mes" :value="mes">{{ mes }}</option>
          </select>
        </label>
        <label class="block space-y-1">
          <span class="text-text-muted">Aerolínea</span>
          <select
            v-model="filtro.aerolineaId"
            aria-label="Aerolínea"
            class="block min-h-11 w-full rounded-md border border-border-subtle bg-surface-card px-2 text-text-main"
            :disabled="!opciones?.aerolineas.length"
          >
            <option value="">Todas las aerolíneas</option>
            <option v-for="operador in opciones?.aerolineas" :key="operador.id" :value="operador.id">
              {{ operador.iata ? `${operador.iata} · ` : '' }}{{ operador.nombre }}
            </option>
          </select>
        </label>
        <p v-if="errorOpciones || error" role="alert" class="text-sm text-error">
          {{ errorOpciones ? 'No se pudieron cargar los filtros.' : 'No se pudo consultar la puntualidad.' }}
        </p>
        <p v-else-if="cargandoOpciones || cargando" role="status" class="text-sm text-text-muted">Consultando puntualidad…</p>
        <p v-else-if="!opciones?.periodos.length" class="text-sm text-text-muted">Todavía no hay meses con operaciones.</p>
        <p v-else-if="!filtro.periodo" class="text-sm text-text-muted">Todavía no hay un mes BTS completo publicado.</p>
        <UButton color="neutral" variant="ghost" label="Actualizar puntualidad" :disabled="cargando || cargandoOpciones" @click="actualizar" />
      </section>
    </template>
  </UPopover>
</template>
