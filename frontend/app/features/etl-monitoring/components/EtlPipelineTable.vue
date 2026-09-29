<script setup lang="ts">
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
    <div class="overflow-x-auto">
      <table
        class="w-full text-left text-xs divide-y divide-border-subtle/70 font-sans"
      >
        <thead
          class="bg-surface-accent/60 text-text-muted font-mono uppercase text-[10px] tracking-wider select-none"
        >
          <tr>
            <th scope="col" class="py-3 px-4 font-semibold">
              Fuente / Dataset
            </th>
            <th scope="col" class="py-3 px-3 font-semibold">Estado</th>
            <th scope="col" class="py-3 px-3 font-semibold">Progreso</th>
            <th scope="col" class="py-3 px-3 font-semibold">
              Filas Procesadas
            </th>
            <th scope="col" class="py-3 px-3 font-semibold">Descartes</th>
            <th
              scope="col"
              class="py-3 px-3 font-semibold hidden lg:table-cell"
            >
              Frecuencia
            </th>
            <th scope="col" class="py-3 px-4 font-semibold text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle/50 text-text-main">
          <tr
            v-for="p in props.pipelines"
            :key="p.id"
            class="hover:bg-surface-accent/30 transition-colors"
          >
            <!-- 1. Fuente y Dataset -->
            <td class="py-3 px-4">
              <div class="flex items-center gap-2.5 min-w-50">
                <div
                  class="w-8 h-8 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
                >
                  <UIcon :name="p.icon" class="w-4 h-4" />
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-text-main block truncate text-xs">
                    {{ p.name }}
                  </span>
                  <span
                    class="text-[11px] text-text-muted block truncate font-mono"
                  >
                    {{ p.datasetName }}
                  </span>
                </div>
              </div>
            </td>

            <!-- 2. Estado -->
            <td class="py-3 px-3 whitespace-nowrap">
              <UBadge
                v-if="p.status === 'success'"
                color="success"
                variant="subtle"
                size="sm"
                class="gap-1.5 border border-emerald-500/30 font-mono tabular-nums text-[11px]"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Al día
              </UBadge>
              <UBadge
                v-else-if="p.status === 'running'"
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
                v-else-if="p.status === 'paused'"
                color="warning"
                variant="subtle"
                size="sm"
                class="gap-1.5 border border-amber-500/30 font-mono tabular-nums text-[11px]"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Pausado
              </UBadge>
              <UBadge
                v-else-if="p.status === 'error'"
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
            </td>

            <!-- 3. Progreso -->
            <td class="py-3 px-3 min-w-32.5">
              <div
                v-if="p.status === 'running' || p.status === 'paused'"
                class="space-y-1"
              >
                <div
                  class="flex items-center justify-between text-[11px] font-mono"
                >
                  <span class="text-text-muted">Lotes</span>
                  <span class="font-bold text-text-main tabular-nums"
                    >{{ p.progressPercent }}%</span
                  >
                </div>
                <UProgress
                  :model-value="p.progressPercent"
                  size="xs"
                  color="primary"
                  class="h-1 rounded-full"
                />
              </div>
              <span
                v-else-if="p.status === 'success'"
                class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"
              >
                <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
                100% Ingestado
              </span>
              <span v-else class="text-[11px] font-mono text-text-dim">
                Pendiente
              </span>
            </td>

            <!-- 4. Filas Procesadas -->
            <td class="py-3 px-3 whitespace-nowrap">
              <span
                class="font-mono tabular-nums font-bold text-text-main block"
              >
                {{ p.processedRows.toLocaleString() }}
              </span>
              <span class="text-[10px] text-text-dim font-mono block">
                ~{{ p.averageSpeedRowsPerSec.toLocaleString() }} fil/s
              </span>
            </td>

            <!-- 5. Descartes -->
            <td class="py-3 px-3 whitespace-nowrap">
              <button
                v-if="p.discardedRows > 0"
                type="button"
                class="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                @click="emit('view-discarded', p)"
              >
                <span>{{ p.discardedRows.toLocaleString() }}</span>
                <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5" />
              </button>
              <span v-else class="text-text-dim font-mono tabular-nums">
                0
              </span>
              <span class="text-[10px] text-text-dim font-mono block">
                {{ formatErrorRate(p) }}
              </span>
            </td>

            <!-- 6. Frecuencia Programada -->
            <td
              class="py-3 px-3 whitespace-nowrap hidden lg:table-cell text-[11px] font-mono text-text-muted"
            >
              {{ p.scheduleDescription }}
            </td>

            <!-- 7. Acciones Rápidas -->
            <td class="py-3 px-4 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-1.5 font-mono">
                <UButton
                  v-if="p.discardedRows > 0"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-file-text"
                  title="Auditar descartes"
                  aria-label="Auditar descartes"
                  class="cursor-pointer"
                  @click="emit('view-discarded', p)"
                />

                <UButton
                  v-if="p.status === 'running'"
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-pause"
                  title="Pausar pipeline"
                  aria-label="Pausar pipeline"
                  class="cursor-pointer"
                  @click="emit('pause', p.id)"
                />
                <UButton
                  v-else-if="p.status === 'paused'"
                  size="xs"
                  color="primary"
                  icon="i-lucide-play"
                  title="Reanudar pipeline"
                  aria-label="Reanudar pipeline"
                  class="cursor-pointer text-white"
                  @click="emit('resume', p.id)"
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
                  @click="emit('trigger-sync', p)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
