<script setup lang="ts">
import { ref, watch } from 'vue';
import type { EtlPipeline, TriggerSyncOptions } from '../types/etl';

interface Props {
  isOpen: boolean;
  pipeline: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', options: TriggerSyncOptions): void;
}>();

const mode = ref<'incremental' | 'full'>('incremental');
const dryRun = ref(false);
const batchSize = ref(2500);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      mode.value = 'incremental';
      dryRun.value = false;
      batchSize.value = 2500;
    }
  }
);

function handleConfirm() {
  if (!props.pipeline) return;

  emit('confirm', {
    pipelineId: props.pipeline.id,
    mode: mode.value,
    dryRun: dryRun.value,
    batchSize: batchSize.value,
  });
  emit('close');
}
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    :title="`Sincronizar ${pipeline?.name ?? ''}`"
    description="Configura los parámetros de la ingesta antes de iniciar el procesamiento."
    :ui="{ content: 'max-w-lg' }"
    @update:open="(val: boolean) => { if (!val) emit('close'); }"
  >
    <template #body>
      <div v-if="pipeline" class="space-y-4 text-xs">
        <!-- 1. Modo de Ingesta -->
        <div>
          <label class="block font-semibold text-text-main mb-1.5">
            Tipo de sincronización
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="p-3 rounded-lg border text-left cursor-pointer transition-colors"
              :class="
                mode === 'incremental'
                  ? 'border-primary bg-surface-accent font-semibold text-text-main ring-1 ring-primary'
                  : 'border-border-subtle bg-surface-card text-text-muted hover:border-text-muted'
              "
              @click="mode = 'incremental'"
            >
              <div class="flex items-center gap-1.5 mb-1">
                <UIcon name="i-lucide-zap" class="w-3.5 h-3.5 text-primary" />
                <span class="text-xs font-bold">Incremental</span>
              </div>
              <p class="text-[11px] font-normal leading-normal text-text-muted">
                Solo registros nuevos o modificados. Rápido y recomendado.
              </p>
            </button>

            <button
              type="button"
              class="p-3 rounded-lg border text-left cursor-pointer transition-colors"
              :class="
                mode === 'full'
                  ? 'border-primary bg-surface-accent font-semibold text-text-main ring-1 ring-primary'
                  : 'border-border-subtle bg-surface-card text-text-muted hover:border-text-muted'
              "
              @click="mode = 'full'"
            >
              <div class="flex items-center gap-1.5 mb-1">
                <UIcon name="i-lucide-rotate-ccw" class="w-3.5 h-3.5 text-amber-500" />
                <span class="text-xs font-bold">Completa</span>
              </div>
              <p class="text-[11px] font-normal leading-normal text-text-muted">
                Re-escaneo total desde la fuente. Requiere más tiempo.
              </p>
            </button>
          </div>
        </div>

        <!-- 2. Tamaño de Lote (Chunk Size) -->
        <div>
          <label class="block font-semibold text-text-main mb-1">
            Tamaño de lote (registros por worker)
          </label>
          <p class="text-[11px] text-text-muted mb-2">
            Procesa en chunks desacoplados para proteger la memoria RAM (RNF-04).
          </p>
          <div class="flex items-center gap-2">
            <UButton
              v-for="size in [1000, 2500, 5000]"
              :key="size"
              :variant="batchSize === size ? 'subtle' : 'outline'"
              :color="batchSize === size ? 'primary' : 'neutral'"
              size="sm"
              class="flex-1 justify-center font-mono text-xs cursor-pointer"
              @click="batchSize = size"
            >
              {{ size.toLocaleString() }} filas
            </UButton>
          </div>
        </div>

        <!-- 3. Modo Seguro Dry Run con UCheckbox -->
        <div class="pt-2 border-t border-border-subtle/60">
          <UCheckbox
            v-model="dryRun"
            label="Modo de prueba (Dry-run / Validación)"
            description="Valida la estructura, coordenadas y códigos sin modificar la base de datos ni invalidar cachés."
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-end gap-2.5">
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          class="text-xs font-semibold cursor-pointer"
          @click="emit('close')"
        >
          Cancelar
        </UButton>
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-play"
          class="text-xs font-semibold cursor-pointer text-white"
          @click="handleConfirm"
        >
          Iniciar Ingesta
        </UButton>
      </div>
    </template>
  </UModal>
</template>
