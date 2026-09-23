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
  <Teleport to="body">
    <div
      v-if="isOpen && pipeline"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`discarded-title-${pipeline.id}`"
    >
      <!-- Contenedor del Modal: Plano, Sólido, Sin Blur, Sin Glow -->
      <div
        class="w-full max-w-2xl rounded-xl border border-border-subtle bg-surface-card shadow-lg p-6 space-y-5"
      >
        <!-- Cabecera -->
        <div class="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 :id="`discarded-title-${pipeline.id}`" class="text-base font-bold text-text-main">
                Auditoría de Registros Descartados — {{ pipeline.name }}
              </h3>
            </div>
            <p class="text-xs text-text-muted mt-1">
              Estos registros fueron omitidos durante la ingesta porque no cumplieron con las reglas de integridad de datos.
            </p>
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

        <!-- Resumen de descartes -->
        <div class="p-3 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-between text-xs">
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
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Campo: {{ record.field }}
                </span>
              </div>

              <!-- Estado de resolución -->
              <span
                v-if="record.resolved"
                class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" />
                Subsanado
              </span>
              <button
                v-else
                type="button"
                class="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                @click="emit('resolve', record.id)"
              >
                Marcar como subsanado
              </button>
            </div>

            <!-- Explicación amigable -->
            <p class="text-text-main font-medium leading-relaxed">
              {{ record.reason }}
            </p>

            <!-- Datos crudos recibidos -->
            <div class="p-2 rounded bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim truncate">
              {{ record.rawSample }}
            </div>
          </div>
        </div>

        <!-- Pie de modal -->
        <div class="pt-3 border-t border-border-subtle flex items-center justify-between">
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
      </div>
    </div>
  </Teleport>
</template>
