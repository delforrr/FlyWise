<script setup lang="ts">
import { ref, computed } from 'vue';
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

const fieldFilter = ref<string>('all');
const copiedRecordId = ref<string | null>(null);

const uniqueFields = computed<string[]>(() => {
  if (!props.pipeline?.discardedSamples) return [];
  const fields = new Set(props.pipeline.discardedSamples.map((s) => s.field));
  return Array.from(fields);
});

const fieldOptions = computed(() => {
  const total = props.pipeline?.discardedSamples.length ?? 0;
  const options = [{ label: `Todos los campos (${total})`, value: 'all' }];
  for (const f of uniqueFields.value) {
    options.push({ label: f, value: f });
  }
  return options;
});

const filteredSamples = computed(() => {
  if (!props.pipeline?.discardedSamples) return [];
  if (fieldFilter.value === 'all') return props.pipeline.discardedSamples;
  return props.pipeline.discardedSamples.filter((s) => s.field === fieldFilter.value);
});

async function copyRawSample(id: string, text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    copiedRecordId.value = id;
    setTimeout(() => {
      if (copiedRecordId.value === id) {
        copiedRecordId.value = null;
      }
    }, 1800);
  }
}

function exportDiscardedCsv() {
  if (!props.pipeline?.discardedSamples || typeof window === 'undefined') return;

  const headers = ['RowIndex', 'Field', 'Reason', 'RawSample', 'Resolved', 'Timestamp'];
  const rows = props.pipeline.discardedSamples.map((s) => [
    s.rowIndex,
    `"${s.field}"`,
    `"${s.reason.replace(/"/g, '""')}"`,
    `"${s.rawSample.replace(/"/g, '""')}"`,
    s.resolved ? 'true' : 'false',
    `"${s.timestamp}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `flywise-discarded-${props.pipeline.id}-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    :title="`Auditoría de Registros Descartados — ${pipeline?.name ?? ''}`"
    description="Registros omitidos durante la ingesta streaming por incumplimiento de reglas de integridad (RNF-03/04)."
    :ui="{
      content: 'sm:max-w-2xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="(val: boolean) => { if (!val) emit('close'); }"
  >
    <template #body>
      <div v-if="pipeline" class="space-y-4">
        <!-- Resumen y Filtro de Campo -->
        <div
          class="p-3.5 rounded-xl bg-surface-accent border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div>
            <span class="text-text-muted">Total de registros observados:</span>
            <span class="font-bold text-text-main ml-1.5 font-mono tabular-nums">
              {{ pipeline.discardedRows }} filas
            </span>
          </div>

          <div class="flex items-center gap-2 font-mono">
            <span class="text-text-dim text-[11px]">Filtrar campo:</span>
            <USelect
              v-model="fieldFilter"
              :items="fieldOptions"
              size="xs"
              class="w-52 font-mono text-[11px]"
            />
          </div>
        </div>

        <!-- Listado de registros con detalle comprensible -->
        <div class="space-y-3 max-h-80 overflow-y-auto pr-1 font-feature-tech">
          <div
            v-for="record in filteredSamples"
            :key="record.id"
            class="p-3.5 rounded-xl border border-border-subtle bg-surface-card text-xs space-y-2.5 shadow-xs"
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
                class="font-semibold p-0 cursor-pointer font-mono text-[11px]"
                @click="emit('resolve', record.id)"
              >
                Marcar como subsanado
              </UButton>
            </div>

            <!-- Explicación amigable -->
            <p class="text-text-main font-medium leading-relaxed">
              {{ record.reason }}
            </p>

            <!-- Datos crudos recibidos con botón de copia rápida UButton -->
            <div class="relative group">
              <div
                class="p-2.5 rounded-lg bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim break-all pr-20"
              >
                {{ record.rawSample }}
              </div>
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                :icon="copiedRecordId === record.id ? 'i-lucide-check' : 'i-lucide-copy'"
                :label="copiedRecordId === record.id ? 'Copiado' : 'Copiar'"
                class="absolute top-2 right-2 text-[10px] font-mono cursor-pointer"
                :class="{ 'text-emerald-500': copiedRecordId === record.id }"
                title="Copiar datos crudos"
                @click="copyRawSample(record.id, record.rawSample)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-download"
          class="border-border-subtle cursor-pointer"
          @click="exportDiscardedCsv"
        >
          Descargar Reporte (.CSV)
        </UButton>

        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            class="text-xs cursor-pointer"
            @click="emit('close')"
          >
            Cerrar
          </UButton>
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-rotate-cw"
            class="text-xs font-bold cursor-pointer text-white shadow-xs"
            @click="emit('retry-all')"
          >
            Reintentar Ingesta
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
