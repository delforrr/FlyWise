<script setup lang="ts">
import { triggerSyncSchema } from '../schemas/pipelineSchemas';
import type { ProcesoEtl, TriggerSyncOptions } from '../types/etl';
const props = defineProps<{ isOpen: boolean; proceso: ProcesoEtl | null }>();
const emit = defineEmits<{ close: []; confirm: [options: TriggerSyncOptions] }>();
function confirm() {
  const result = triggerSyncSchema.safeParse({ procesoId: props.proceso?.id });
  if (result.success) emit('confirm', result.data);
}
</script>
<template>
  <UModal :open="isOpen" :title="`Sincronizar ${proceso?.nombre ?? ''}`" description="Se procesará la fuente completa y se actualizarán los registros existentes sin duplicarlos." @update:open="val => { if (!val) emit('close') }">
    <template #body>
      <p class="text-sm text-text-muted">La ejecución usará el mapeo y tamaño de lote guardados. Los errores quedarán en el historial y podrán reintentarse como una ejecución completa.</p>
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" @click="emit('close')">Cancelar</UButton>
      <UButton :disabled="!proceso || proceso.estado === 'running' || proceso.entidadDestino === 'otp_metrics'" @click="confirm">Ejecutar sincronización</UButton>
    </template>
  </UModal>
</template>
