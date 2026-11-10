<script setup lang="ts">
import type { RouteMetric } from '~/types/route';
import { useRouteMetricOverlay } from '~/features/flight-map/composables/useRouteMetrics';

const props = defineProps<{ metricas: RouteMetric }>();
const { opciones } = useRouteMetricOverlay();
const operador = computed(() => props.metricas.aerolineaId
  ? opciones.value?.aerolineas.find((a) => a.id === props.metricas.aerolineaId)?.nombre ?? 'Aerolínea seleccionada'
  : 'Todas las aerolíneas');
const fuentes = computed(() => props.metricas.fuentes
  .map((fuente) => fuente === 'Administrativa' ? 'Registro manual' : fuente).join(', '));
const numero = new Intl.NumberFormat('es-AR');
</script>

<template>
  <div class="space-y-1.5 text-xs text-text-muted">
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt>Período</dt>
      <dd class="text-text-main">{{ metricas.periodo }} · {{ operador }}</dd>
      <template v-if="metricas.actualizadoEn || metricas.vuelosTotales">
        <dt>Muestra</dt>
        <dd class="text-text-main tabular-nums">
          {{ numero.format(metricas.vuelosOperados) }} operados de {{ numero.format(metricas.vuelosTotales) }}
        </dd>
      </template>
      <template v-if="fuentes">
        <dt>Fuentes</dt>
        <dd class="text-text-main">{{ fuentes }}</dd>
      </template>
      <template v-if="metricas.actualizadoEn">
        <dt>Último cálculo</dt>
        <dd class="text-text-main tabular-nums">{{ metricas.actualizadoEn.slice(0, 16).replace('T', ' ') }} UTC</dd>
      </template>
    </dl>
    <p v-if="metricas.errorActualizacion" class="text-error">No se pudo actualizar el cálculo.</p>
    <p v-else-if="metricas.pendiente" role="status">Actualización pendiente.</p>
  </div>
</template>
