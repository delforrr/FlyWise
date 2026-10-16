<script setup lang="ts">
import type { EtlPipeline } from "../types/etl";

interface Props {
  isOpen: boolean;
  pipeline: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm", id: string): void;
}>();

function handleConfirm() {
  if (props.pipeline) {
    emit("confirm", props.pipeline.id);
    emit("close");
  }
}
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    title="Eliminar Servicio de Ingesta"
    description="Esta acción removerá el pipeline y sus configuraciones de conexión."
    :ui="{
      content:
        'max-w-md bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div v-if="pipeline" class="space-y-3.5 text-xs">
        <div
          class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-600 dark:text-rose-400"
        >
          <UIcon
            name="i-lucide-alert-triangle"
            class="w-5 h-5 shrink-0 mt-0.5"
          />
          <div class="space-y-1">
            <span class="font-bold block">
              ¿Estás seguro de que deseas eliminar este servicio?
            </span>
            <p class="text-[11px] leading-relaxed text-text-muted">
              Se eliminará la configuración del pipeline
              <strong class="text-text-main font-semibold">"{{ pipeline.name }}"</strong>
              y se cancelarán las tareas programadas en BullMQ asociadas a esta fuente.
            </p>
          </div>
        </div>

        <div
          class="p-2.5 rounded-lg bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim truncate"
        >
          Endpoint: {{ pipeline.connection?.endpointUrl || "Sin endpoint registrado" }}
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-end gap-2">
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
          color="error"
          size="sm"
          icon="i-lucide-trash-2"
          class="text-xs font-semibold cursor-pointer text-white"
          @click="handleConfirm"
        >
          Eliminar Definitivamente
        </UButton>
      </div>
    </template>
  </UModal>
</template>
