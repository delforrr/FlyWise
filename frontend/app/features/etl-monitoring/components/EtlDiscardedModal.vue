<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { ProcesoEtl } from "../types/etl";
import { useEtlData } from '../composables/useEtlData';

interface Props {
  isOpen: boolean;
  proceso: ProcesoEtl | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "retry-all"): void;
}>();

const fieldFilter = ref<string>("all");
const selectedAttempt = ref(0);
const samplesLoading = ref(false);
const { loadSamples } = useEtlData();
const toast = useToast();
const attemptOptions = computed(() => Array.from({ length: (props.proceso?.intento ?? 0) + 1 }, (_, value) => ({ value, label: value === 0 ? 'Histórico sin intento' : `Intento ${value}` })));
watch(() => [props.proceso?.latestJobId, props.proceso?.intento], () => { selectedAttempt.value = props.proceso?.intento ?? 0; }, { immediate: true });
async function selectAttempt(value: number) {
  if (!props.proceso || samplesLoading.value) return;
  samplesLoading.value = true;
  try {
    await loadSamples(props.proceso, value);
    selectedAttempt.value = value;
    fieldFilter.value = 'all';
  } catch { toast.add({ title: 'No se pudieron cargar las muestras del intento', color: 'error' }); }
  finally { samplesLoading.value = false; }
}
const copiedRecordId = ref<string | null>(null);

const uniqueFields = computed<string[]>(() => {
  if (!props.proceso?.muestrasDescartadas) return [];
  const fields = new Set(props.proceso.muestrasDescartadas.map((s) => s.campo));
  return Array.from(fields);
});

const fieldOptions = computed(() => {
  const total = props.proceso?.muestrasDescartadas.length ?? 0;
  const options = [{ label: `Todos los campos (${total})`, value: "all" }];
  for (const f of uniqueFields.value) {
    options.push({ label: f, value: f });
  }
  return options;
});

const filteredSamples = computed(() => {
  if (!props.proceso?.muestrasDescartadas) return [];
  if (fieldFilter.value === "all") return props.proceso.muestrasDescartadas;
  return props.proceso.muestrasDescartadas.filter(
    (s) => s.campo === fieldFilter.value,
  );
});

async function copyRawSample(id: string, text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
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
  if (!props.proceso?.muestrasDescartadas || typeof window === "undefined")
    return;

  const headers = [
    "Attempt",
    "RowIndex",
    "Field",
    "Reason",
    "RawSample",
    "Timestamp",
  ];
  const rows = props.proceso.muestrasDescartadas.map((s) => [
    s.intento ?? 0,
    s.numeroFila,
    `"${s.campo}"`,
    `"${s.motivo.replaceAll('"', '""')}"`,
    `"${s.muestraOriginal.replaceAll('"', '""')}"`,
    `"${s.timestamp}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `flywise-discarded-${props.proceso.id}-${Date.now()}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <UModal
    :open="isOpen && !!proceso"
    :title="`Auditoría de Registros Descartados — ${proceso?.nombre ?? ''}`"
    description="Registros omitidos durante la ingesta streaming por incumplimiento de reglas de integridad (RNF-03/04)."
    :ui="{
      content:
        'sm:max-w-2xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div v-if="proceso" class="space-y-4">
        <USelect :model-value="selectedAttempt" :items="attemptOptions" :disabled="samplesLoading" :loading="samplesLoading" aria-label="Intento de ejecución" @update:model-value="selectAttempt" />
        <!-- Resumen y Filtro de Campo -->
        <div
          class="p-3.5 rounded-xl bg-surface-accent border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div>
            <span class="text-text-muted">Muestras del intento seleccionado:</span>
            <span
              class="font-bold text-text-main ml-1.5 font-mono tabular-nums"
            >
              {{ proceso.muestrasDescartadas.length }} filas
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
                  Fila #{{ record.numeroFila }}
                </span>
                <UBadge
                  color="warning"
                  variant="subtle"
                  size="sm"
                  class="font-mono text-[10px]"
                >
                  Campo: {{ record.campo }}
                </UBadge>
              </div>


            </div>

            <!-- Explicación amigable -->
            <p class="text-text-main font-medium leading-relaxed">
              {{ record.motivo }}
            </p>

            <!-- Datos crudos recibidos con botón de copia rápida UButton -->
            <div class="relative group">
              <div
                class="p-2.5 rounded-lg bg-surface-accent border border-border-subtle font-mono text-[11px] text-text-dim break-all pr-20"
              >
                {{ record.muestraOriginal }}
              </div>
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                :icon="
                  copiedRecordId === record.id
                    ? 'i-lucide-check'
                    : 'i-lucide-copy'
                "
                :label="copiedRecordId === record.id ? 'Copiado' : 'Copiar'"
                class="absolute top-2 right-2 text-[10px] font-mono cursor-pointer"
                :class="{ 'text-emerald-500': copiedRecordId === record.id }"
                title="Copiar datos crudos"
                @click="copyRawSample(record.id, record.muestraOriginal)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        class="w-full flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs"
      >
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
            Reintentar ejecución completa
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
