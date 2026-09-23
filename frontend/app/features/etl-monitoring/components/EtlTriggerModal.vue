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
  <Teleport to="body">
    <div
      v-if="isOpen && pipeline"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`modal-title-${pipeline.id}`"
    >
      <!-- Contenedor del Modal: Plano, Sólido, Sin Blur, Sin Glow -->
      <div
        class="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-card shadow-lg p-6 space-y-5"
      >
        <!-- Cabecera -->
        <div class="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary">
              <UIcon :name="pipeline.icon" class="w-4 h-4" />
            </span>
            <div>
              <h3 :id="`modal-title-${pipeline.id}`" class="text-base font-bold text-text-main">
                Sincronizar {{ pipeline.name }}
              </h3>
              <p class="text-xs text-text-muted">
                Configura los parámetros de la ingesta antes de iniciar el procesamiento.
              </p>
            </div>
          </div>

          <button
            type="button"
            class="text-text-muted hover:text-text-main p-1 rounded-md cursor-pointer"
            aria-label="Cerrar modal"
            @click="emit('close')"
          >
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Formulario de opciones -->
        <div class="space-y-4 text-xs">
          <!-- 1. Modo de Ingesta -->
          <div>
            <label class="block font-semibold text-text-main mb-1.5">
              Tipo de sincronización
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="p-3 rounded-lg border text-left cursor-pointer transition-colors"
                :class="mode === 'incremental' ? 'border-primary bg-surface-accent font-semibold text-text-main' : 'border-border-subtle bg-surface-card text-text-muted hover:border-text-muted'"
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
                :class="mode === 'full' ? 'border-primary bg-surface-accent font-semibold text-text-main' : 'border-border-subtle bg-surface-card text-text-muted hover:border-text-muted'"
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
              <button
                v-for="size in [1000, 2500, 5000]"
                :key="size"
                type="button"
                class="flex-1 py-1.5 px-3 rounded-md border text-center font-mono cursor-pointer transition-colors"
                :class="batchSize === size ? 'border-primary bg-surface-accent text-primary font-bold' : 'border-border-subtle bg-surface-card text-text-muted hover:text-text-main'"
                @click="batchSize = size"
              >
                {{ size.toLocaleString() }} filas
              </button>
            </div>
          </div>

          <!-- 3. Modo Seguro Dry Run -->
          <div class="pt-2 border-t border-border-subtle/60">
            <label class="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                v-model="dryRun"
                type="checkbox"
                class="mt-0.5 rounded border-border-subtle text-primary focus:ring-0 cursor-pointer"
              />
              <div>
                <span class="font-semibold text-text-main block">
                  Modo de prueba (Dry-run / Validación)
                </span>
                <span class="text-[11px] text-text-muted block">
                  Valida la estructura, coordenadas y códigos sin modificar la base de datos ni invalidar cachés.
                </span>
              </div>
            </label>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="pt-3 border-t border-border-subtle flex items-center justify-end gap-2.5">
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
      </div>
    </div>
  </Teleport>
</template>
