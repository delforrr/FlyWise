<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useEtlData } from '../composables/useEtlData';
import type { EtlJobRecord, ProcesoEtl } from '../types/etl';

const props = defineProps<{ servicio: ProcesoEtl }>();
const emit = defineEmits<{ close: [] }>();
const { request } = useEtlData();
const trabajos = ref<EtlJobRecord[]>([]);
const cargando = ref(true);
const error = ref(false);
const estados: Record<EtlJobRecord['estado'], string> = {
  pending: 'En cola',
  running: 'En curso',
  completed: 'Completada',
  failed: 'Fallida',
};
const titulo = computed(() => `Historial de ${props.servicio.nombre}`);

async function cargar() {
  cargando.value = true;
  error.value = false;
  try {
    trabajos.value = await request<EtlJobRecord[]>(`/etl/procesos/${props.servicio.id}/historial`);
  } catch {
    error.value = true;
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <UModal :open="true" :title="titulo" @update:open="open => { if (!open) emit('close') }">
    <template #body>
      <p v-if="cargando" role="status">Cargando historial…</p>
      <p v-else-if="error" role="alert">No se pudo cargar el historial.</p>
      <p v-else-if="!trabajos.length">Sin ejecuciones.</p>
      <ul v-else class="divide-y divide-border-subtle">
        <li v-for="trabajo in trabajos" :key="trabajo.id" class="space-y-1 break-words py-2 text-sm">
          <p><strong>{{ trabajo.fuente }} · {{ estados[trabajo.estado] }}</strong></p>
          <p>{{ trabajo.id }}</p>
          <p>{{ trabajo.filasProcesadas }} procesadas · {{ trabajo.filasDescartadas }} descartadas</p>
          <p v-if="trabajo.mensajeError" class="text-error">{{ trabajo.mensajeError }}</p>
        </li>
      </ul>
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" :loading="cargando" @click="cargar">Actualizar</UButton>
    </template>
  </UModal>
</template>
