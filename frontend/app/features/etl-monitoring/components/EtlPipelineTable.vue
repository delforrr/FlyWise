<script setup lang="ts">
import { ref, computed } from "vue";
import type { TableColumn } from "@nuxt/ui";
import type { EtlPipeline } from "../types/etl";

interface Props {
  pipelines: EtlPipeline[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "trigger-sync", pipeline: EtlPipeline): void;
  (e: "pause", id: EtlPipeline["id"]): void;
  (e: "resume", id: EtlPipeline["id"]): void;
  (e: "retry", id: EtlPipeline["id"]): void;
  (e: "view-discarded", pipeline: EtlPipeline): void;
}>();

const page = ref(1);
const itemsPerPage = ref(10);

const paginatedPipelines = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  return props.pipelines.slice(start, start + itemsPerPage.value);
});

const columns: TableColumn<EtlPipeline>[] = [
  {
    accessorKey: "id",
    id: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    id: "name",
    header: "Fuente / Dataset",
  },
  {
    accessorKey: "status",
    id: "status",
    header: "Estado",
  },
  {
    id: "health",
    header: "Progreso / Salud",
  },
  {
    id: "metrics",
    header: "Métricas / Filas",
  },
  {
    accessorKey: "lastSyncAt",
    id: "lastSync",
    header: "Última Sincronización",
  },
  {
    id: "actions",
    header: "Acciones",
  },
];

function formatErrorRate(pipeline: EtlPipeline): string {
  if (!pipeline.processedRows || pipeline.processedRows <= 0) return "0.00%";
  const rate = (pipeline.discardedRows / pipeline.processedRows) * 100;
  return `${rate.toFixed(2)}%`;
}
</script>

<template>
  <div
    class="rounded-xl border border-border-subtle bg-surface-card overflow-hidden shadow-xs"
  >
    <UTable
      :data="paginatedPipelines"
      :columns="columns"
      class="w-full text-xs font-sans"
    >
      <!-- 1. ID -->
      <template #id-cell="{ row }">
        <span class="font-mono text-xs text-text-muted font-bold">#{{ row.original.id }}</span>
      </template>

      <!-- 2. Fuente / Dataset -->
      <template #name-cell="{ row }">
        <div class="flex items-center gap-2.5 min-w-48 py-1">
          <div
            class="w-8 h-8 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
          >
            <UIcon :name="row.original.icon" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <span class="font-bold text-text-main block truncate text-xs">
              {{ row.original.name }}
            </span>
            <span
              class="text-[11px] text-text-muted block truncate font-mono"
            >
              {{ row.original.datasetName }}
            </span>
          </div>
        </div>
      </template>

      <!-- 3. Estado -->
      <template #status-cell="{ row }">
        <UBadge
          v-if="row.original.status === 'success'"
          color="success"
          variant="subtle"
          size="sm"
          class="gap-1.5 border border-emerald-500/30 font-mono tabular-nums text-[11px]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Al día
        </UBadge>
        <UBadge
          v-else-if="row.original.status === 'running'"
          color="info"
          variant="subtle"
          size="sm"
          class="gap-1.5 border border-sky-500/30 font-mono tabular-nums text-[11px]"
        >
          <span
            class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"
          />
          Sincronizando
        </UBadge>
        <UBadge
          v-else-if="row.original.status === 'paused'"
          color="warning"
          variant="subtle"
          size="sm"
          class="gap-1.5 border border-amber-500/30 font-mono tabular-nums text-[11px]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pausado
        </UBadge>
        <UBadge
          v-else-if="row.original.status === 'error'"
          color="error"
          variant="subtle"
          size="sm"
          class="gap-1.5 border border-rose-500/30 font-mono tabular-nums text-[11px]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Error
        </UBadge>
        <UBadge
          v-else
          color="neutral"
          variant="subtle"
          size="sm"
          class="gap-1.5 font-mono tabular-nums text-[11px]"
        >
          En espera
        </UBadge>
      </template>

      <!-- 4. Salud / Progreso -->
      <template #health-cell="{ row }">
        <div
          v-if="row.original.status === 'running' || row.original.status === 'paused'"
          class="space-y-1 min-w-28"
        >
          <div
            class="flex items-center justify-between text-[11px] font-mono"
          >
            <span class="text-text-muted">Lotes</span>
            <span class="font-bold text-text-main tabular-nums">
              {{ row.original.progressPercent }}%
            </span>
          </div>
          <UProgress
            :model-value="row.original.progressPercent"
            size="xs"
            color="primary"
            class="h-1 rounded-full"
          />
        </div>
        <span
          v-else-if="row.original.status === 'success'"
          class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"
        >
          <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
          100% Ingestado
        </span>
        <span v-else class="text-[11px] font-mono text-text-dim">
          Pendiente
        </span>
      </template>

      <!-- 5. Métricas (Filas y Descartes) -->
      <template #metrics-cell="{ row }">
        <div class="space-y-0.5 whitespace-nowrap">
          <div class="flex items-center gap-1.5 font-mono text-xs">
            <span class="font-bold text-text-main tabular-nums">
              {{ row.original.processedRows.toLocaleString() }}
            </span>
            <span class="text-[10px] text-text-dim">filas</span>
          </div>
          <div class="flex items-center gap-2 text-[10px] font-mono">
            <button
              v-if="row.original.discardedRows > 0"
              type="button"
              class="font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-0.5"
              @click="emit('view-discarded', row.original)"
            >
              <span>{{ row.original.discardedRows.toLocaleString() }} descartes</span>
              <UIcon name="i-lucide-alert-circle" class="w-3 h-3" />
            </button>
            <span v-else class="text-text-dim">0 descartes</span>
            <span class="text-text-dim">({{ formatErrorRate(row.original) }})</span>
          </div>
          <span class="text-[10px] text-text-dim font-mono block">
            ~{{ row.original.averageSpeedRowsPerSec.toLocaleString() }} fil/s
          </span>
        </div>
      </template>

      <!-- 6. Última Sincronización y Frecuencia -->
      <template #lastSync-cell="{ row }">
        <div class="whitespace-nowrap font-mono text-xs">
          <span class="text-text-main block">
            {{ row.original.lastSyncAt || "Sin registros" }}
          </span>
          <span class="text-[10px] text-text-muted block">
            {{ row.original.scheduleDescription }}
          </span>
        </div>
      </template>

      <!-- 7. Acciones -->
      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end gap-1.5 font-mono">
          <UButton
            v-if="row.original.discardedRows > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-file-text"
            title="Auditar descartes"
            aria-label="Auditar descartes"
            class="cursor-pointer"
            @click="emit('view-discarded', row.original)"
          />

          <UButton
            v-if="row.original.status === 'running'"
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-pause"
            title="Pausar pipeline"
            aria-label="Pausar pipeline"
            class="cursor-pointer"
            @click="emit('pause', row.original.id)"
          />
          <UButton
            v-else-if="row.original.status === 'paused'"
            size="xs"
            color="primary"
            icon="i-lucide-play"
            title="Reanudar pipeline"
            aria-label="Reanudar pipeline"
            class="cursor-pointer text-white"
            @click="emit('resume', row.original.id)"
          />
          <UButton
            v-else
            size="xs"
            variant="outline"
            color="primary"
            icon="i-lucide-refresh-cw"
            title="Sincronizar ahora"
            aria-label="Sincronizar ahora"
            class="cursor-pointer"
            @click="emit('trigger-sync', row.original)"
          />
        </div>
      </template>
    </UTable>

    <!-- Paginación reactiva Nuxt UI -->
    <div
      class="p-3 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-surface-card"
    >
      <span class="text-text-muted font-mono text-[11px]">
        Mostrando {{ pipelines.length > 0 ? (page - 1) * itemsPerPage + 1 : 0 }} a {{ Math.min(page * itemsPerPage, pipelines.length) }} de {{ pipelines.length }} pipelines
      </span>
      <UPagination
        v-model:page="page"
        :total="pipelines.length"
        :items-per-page="itemsPerPage"
      />
    </div>
  </div>
</template>
