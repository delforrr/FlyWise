<script setup lang="ts">
import type { EtlPipeline } from '../types/etl';

interface Props {
  isOpen: boolean;
  pipeline: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'resolve', recordId: string): void;
  (e: 'retry-all'): void;
}>();
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    :title="`Auditoría de Registros Descartados — ${pipeline?.name ?? ''}`"
    description="Estos registros fueron omitidos durante la ingesta porque no cumplieron con las reglas de integridad de datos."
    :ui="{ content: 'max-w-2xl' }"
    @update:open="(val: boolean) => { if (!val) emit('close'); }"
  >
    <template #body>
      <div v-if="pipeline" class="space-y-4">
        <!-- Resumen de descartes -->
        <div
          class="p-3 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-between text-xs"
        >
          <div>
            <span class="text-text-muted">Total de registros observados:</span>
            <span class="font-bold text-text-main ml-1.5 font-mono">
              {{ pipeline.discardedRows }} filas
            </span>
          </div>
          <span class="text-text-dim text-[11px]">
            El resto de las filas se procesó normalmente.
          </span>
        </div>

        <!-- Listado de registros con detalle comprensible -->
        <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
          <div
            v-for="record in pipeline.discardedSamples"
            :key="record.id"
            class="p-3.5 rounded-lg border border-border-subtle bg-surface-card text-xs space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-text-main">
                  Fila #{{ record.rowIndex }}
                </span>
                <UBadge
                  color="warning"
                  variant="subtle"
                  size="sm"
                  class="font-mono text-[10px]"
                >
                  Campo: {{ record.field }}
                </UBadge>
              </div>

              <!-- Estado de resolución -->
              <UBadge
                v-if="record.resolved"
                color="success"
                variant="subtle"
                size="sm"
                icon="i-lucide-check-circle"
              >
                Subsanado
              </UBadge>
              <UButton
                v-else
                variant="link"
                color="primary"
                size="xs"
                class="font-semibold p-0 cursor-pointer"
                @click="emit('resolve', record.id)"
              >
                Marcar como subsanado
              </UButton>
            </div>

            <!-- Explicación amigable -->
            <p class="text-text-main font-medium leading-relaxed">
              {{ record.reason }}
            </p>

            <!-- Datos crudos recibidos -->
            <div
              class="p-2 rounded bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim truncate"
            >
              {{ record.rawSample }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-between">
        <span class="text-xs text-text-muted">
          Los registros corregidos pueden reprocesarse en la próxima ejecución.
        </span>
        <div class="flex items-center gap-2">
          <UButton
            variant="outline"
            color="neutral"
            size="sm"
            class="text-xs font-semibold cursor-pointer"
            @click="emit('close')"
          >
            Cerrar
          </UButton>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-rotate-cw"
            class="text-xs font-semibold cursor-pointer text-white"
            @click="emit('retry-all')"
          >
            Reintentar Ingesta
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
