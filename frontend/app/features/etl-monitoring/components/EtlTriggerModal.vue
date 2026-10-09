<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { EtlPipeline, TriggerSyncOptions } from "../types/etl";

interface Props {
  isOpen: boolean;
  pipeline: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", options: TriggerSyncOptions): void;
}>();

const mode = ref<"incremental" | "full">("incremental");
const dryRun = ref(false);
const batchSize = ref(2500);

const modeOptions = [
  {
    value: "incremental",
    label: "Incremental",
    description: "Solo registros nuevos o modificados. Rápido y recomendado.",
  },
  {
    value: "full",
    label: "Completa",
    description: "Re-escaneo total desde la fuente. Requiere más tiempo.",
  },
];

const estimatedDuration = computed(() => {
  if (!props.pipeline || !props.pipeline.averageSpeedRowsPerSec) return null;
  // In incremental mode, estimate ~15% volume of changes
  const targetRows =
    mode.value === "incremental"
      ? Math.max(500, Math.round(props.pipeline.totalEstimatedRows * 0.15))
      : props.pipeline.totalEstimatedRows;

  const seconds = Math.max(
    1,
    Math.round(targetRows / props.pipeline.averageSpeedRowsPerSec),
  );
  const chunks = Math.ceil(targetRows / batchSize.value);

  return {
    targetRows,
    seconds,
    chunks,
  };
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      mode.value = "incremental";
      dryRun.value = false;
      batchSize.value = 2500;
    }
  },
);

function handleConfirm() {
  if (!props.pipeline) return;

  emit("confirm", {
    pipelineId: props.pipeline.id,
    mode: mode.value,
    dryRun: dryRun.value,
    batchSize: batchSize.value,
  });
  emit("close");
}
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    :title="`Sincronizar ${pipeline?.name ?? ''}`"
    description="Configura los parámetros de la ingesta antes de iniciar el procesamiento."
    :ui="{
      content:
        'max-w-lg bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div v-if="pipeline" class="space-y-4 text-xs font-feature-tech">
        <!-- Estimación de Rendimiento y Chunks -->
        <div
          v-if="estimatedDuration"
          class="p-3 rounded-xl bg-surface-accent/70 border border-border-subtle flex items-center justify-between text-[11px]"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-activity" class="w-4 h-4 text-primary" />
            <span class="text-text-muted">Estimación calculada:</span>
            <span class="font-mono font-bold text-text-main tabular-nums">
              ~{{ estimatedDuration.seconds }}s
            </span>
          </div>
          <div class="font-mono text-text-dim text-[10px]">
            {{ estimatedDuration.chunks }} lotes &bull; ~{{
              estimatedDuration.targetRows.toLocaleString()
            }}
            filas
          </div>
        </div>

        <!-- 1. Modo de Ingesta con URadioGroup -->
        <div>
          <label class="block font-semibold text-text-main mb-1.5">
            Tipo de sincronización
          </label>
          <URadioGroup
            v-model="mode"
            :items="modeOptions"
            variant="card"
            orientation="horizontal"
            :ui="{
              fieldset: 'grid grid-cols-2 gap-2 w-full',
              item: 'cursor-pointer transition-colors border-border-subtle bg-surface-card p-3',
              label: 'text-xs font-bold text-text-main',
              description:
                'text-[11px] font-normal leading-normal text-text-muted mt-0.5',
            }"
          />
        </div>

        <!-- 2. Tamaño de Lote (Chunk Size) con UFieldGroup -->
        <div>
          <label class="block font-semibold text-text-main mb-1">
            Tamaño de lote (registros por worker)
          </label>
          <p class="text-[11px] text-text-muted mb-2">
            Procesa en chunks desacoplados para proteger la memoria RAM
            (RNF-04).
          </p>
          <UFieldGroup class="w-full flex">
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
          </UFieldGroup>
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
