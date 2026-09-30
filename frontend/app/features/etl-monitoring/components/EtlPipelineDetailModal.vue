<script setup lang="ts">
import { computed } from "vue";
import type { EtlPipeline } from "../types/etl";

interface Props {
  isOpen: boolean;
  pipeline: EtlPipeline | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "trigger-sync", pipeline: EtlPipeline): void;
  (e: "pause", id: EtlPipeline["id"]): void;
  (e: "resume", id: EtlPipeline["id"]): void;
  (e: "view-discarded", pipeline: EtlPipeline): void;
}>();

// Formateo del tiempo estimado de ejecución según filas y velocidad
const executionTimeFormatted = computed<string | null>(() => {
  if (
    !props.pipeline?.averageSpeedRowsPerSec ||
    props.pipeline.averageSpeedRowsPerSec <= 0
  ) {
    return null;
  }
  const totalSeconds = Math.round(
    props.pipeline.processedRows / props.pipeline.averageSpeedRowsPerSec,
  );
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
});

// Tasa porcentual de registros descartados
const errorRateFormatted = computed<string>(() => {
  if (!props.pipeline?.processedRows || props.pipeline.processedRows <= 0)
    return "0.00%";
  const rate =
    (props.pipeline.discardedRows / props.pipeline.processedRows) * 100;
  return `${rate.toFixed(2)}%`;
});
</script>

<template>
  <UModal
    :open="isOpen && !!pipeline"
    :title="`Detalle de Fuente — ${pipeline?.name ?? ''}`"
    description="Métricas de procesamiento, registros descartados y cronograma de sincronización."
    :ui="{
      content:
        'sm:max-w-xl bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
    }"
    @update:open="
      (val: boolean) => {
        if (!val) emit('close');
      }
    "
  >
    <template #body>
      <div v-if="pipeline" class="space-y-4 font-feature-tech text-xs">
        <!-- 1. Cabecera Informativa de la Fuente -->
        <div
          class="p-3.5 rounded-xl bg-surface-accent/70 border border-border-subtle flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="w-10 h-10 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
            >
              <UIcon :name="pipeline.icon" class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-text-main text-sm truncate">
                  {{ pipeline.name }}
                </span>
                <span class="font-mono text-[11px] text-text-muted">
                  #{{ pipeline.id }}
                </span>
              </div>
              <span
                class="text-[11px] font-mono text-text-muted block truncate"
              >
                {{ pipeline.datasetName }}
              </span>
              <p
                class="text-[11px] text-text-dim mt-1 line-clamp-2 leading-relaxed"
              >
                {{ pipeline.description }}
              </p>
            </div>
          </div>

          <!-- Estado actual del pipeline -->
          <div class="shrink-0">
            <UBadge
              v-if="pipeline.status === 'success'"
              color="success"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-emerald-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Al día
            </UBadge>
            <UBadge
              v-else-if="pipeline.status === 'running'"
              color="info"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-sky-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
              Sincronizando
            </UBadge>
            <UBadge
              v-else-if="pipeline.status === 'paused'"
              color="warning"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-amber-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Pausado
            </UBadge>
            <UBadge
              v-else-if="pipeline.status === 'error'"
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
          </div>
        </div>

        <!-- 2. Progreso técnico activo si está corriendo o pausado -->
        <div
          v-if="pipeline.status === 'running' || pipeline.status === 'paused'"
          class="p-3 rounded-xl border border-border-subtle bg-surface-card space-y-1.5"
        >
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="text-text-muted">Progreso de importación</span>
            <span class="font-bold text-text-main tabular-nums">
              {{ pipeline.progressPercent }}%
            </span>
          </div>
          <UProgress
            :model-value="pipeline.progressPercent"
            size="xs"
            color="primary"
            class="h-1.5 rounded-full"
          />
          <p
            v-if="pipeline.currentStepMessage"
            class="text-[11px] text-text-dim font-mono truncate pt-0.5"
          >
            {{ pipeline.currentStepMessage }}
          </p>
        </div>

        <!-- 3. Métricas de Filas (Procesadas vs Descartadas) -->
        <div class="space-y-1.5">
          <span
            class="text-[11px] font-semibold text-text-muted uppercase tracking-wider block"
          >
            Volumen y Calidad de Datos
          </span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Filas Procesadas -->
            <div
              class="p-3.5 rounded-xl border border-border-subtle bg-surface-card space-y-2 shadow-xs"
            >
              <div class="flex items-center justify-between">
                <span class="text-text-muted text-[11px]"
                  >Filas procesadas</span
                >
                <UIcon name="i-lucide-database" class="w-4 h-4 text-primary" />
              </div>
              <div>
                <span
                  class="font-mono text-lg font-bold text-text-main tabular-nums block leading-none"
                >
                  {{ pipeline.processedRows.toLocaleString() }}
                </span>
                <span class="text-[10px] text-text-dim font-mono block mt-1">
                  de ~{{ pipeline.totalEstimatedRows.toLocaleString() }}
                  estimadas
                </span>
              </div>
              <div
                class="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[10px] font-mono text-text-muted"
              >
                <span>Velocidad media:</span>
                <span class="tabular-nums font-semibold text-text-main">
                  ~{{ pipeline.averageSpeedRowsPerSec.toLocaleString() }} fil/s
                </span>
              </div>
            </div>

            <!-- Filas Descartadas -->
            <div
              class="p-3.5 rounded-xl border border-border-subtle bg-surface-card space-y-2 shadow-xs"
            >
              <div class="flex items-center justify-between">
                <span class="text-text-muted text-[11px]"
                  >Filas descartadas</span
                >
                <UIcon
                  :name="
                    pipeline.discardedRows > 0
                      ? 'i-lucide-alert-circle'
                      : 'i-lucide-check-circle'
                  "
                  class="w-4 h-4"
                  :class="
                    pipeline.discardedRows > 0
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  "
                />
              </div>
              <div>
                <div class="flex items-baseline gap-2">
                  <span
                    class="font-mono text-lg font-bold tabular-nums leading-none"
                    :class="
                      pipeline.discardedRows > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-text-main'
                    "
                  >
                    {{ pipeline.discardedRows.toLocaleString() }}
                  </span>
                  <span class="text-[10px] font-mono text-text-dim">
                    ({{ errorRateFormatted }})
                  </span>
                </div>
                <span
                  class="text-[10px] font-mono block mt-1"
                  :class="
                    pipeline.discardedRows > 0
                      ? 'text-amber-600/80 dark:text-amber-400/80'
                      : 'text-emerald-600 dark:text-emerald-400'
                  "
                >
                  {{
                    pipeline.discardedRows > 0
                      ? "Registros omitidos por integridad"
                      : "100% registros conformes"
                  }}
                </span>
              </div>

              <!-- Enlace directo para auditar si hay descartes -->
              <div
                class="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[10px] font-mono"
              >
                <span class="text-text-muted">Auditoría descartes:</span>
                <UButton
                  v-if="pipeline.discardedRows > 0"
                  variant="link"
                  color="warning"
                  size="xs"
                  class="p-0 text-[10px] font-bold cursor-pointer underline"
                  @click="emit('view-discarded', pipeline)"
                >
                  Ver muestras
                </UButton>
                <span v-else class="text-emerald-500 font-semibold"
                  >Sin anomalías</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Cronograma de Sincronización -->
        <div class="space-y-1.5">
          <span
            class="text-[11px] font-semibold text-text-muted uppercase tracking-wider block"
          >
            Cronograma de Ingesta
          </span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Última Sincronización -->
            <div
              class="p-3 rounded-xl border border-border-subtle bg-surface-card space-y-1 shadow-xs"
            >
              <div
                class="flex items-center gap-1.5 text-text-muted text-[11px]"
              >
                <UIcon name="i-lucide-history" class="w-3.5 h-3.5" />
                <span>Última sincronización</span>
              </div>
              <span
                class="font-mono text-xs font-semibold text-text-main block tabular-nums"
              >
                {{ pipeline.lastSyncAt || "Sin registros previos" }}
              </span>
              <span class="text-[10px] font-mono text-text-dim block">
                {{
                  executionTimeFormatted
                    ? `Tiempo de corrida: ~${executionTimeFormatted}`
                    : "Carga histórica inicial"
                }}
              </span>
            </div>

            <!-- Próxima Programada -->
            <div
              class="p-3 rounded-xl border border-border-subtle bg-surface-card space-y-1 shadow-xs"
            >
              <div
                class="flex items-center gap-1.5 text-text-muted text-[11px]"
              >
                <UIcon
                  name="i-lucide-calendar-clock"
                  class="w-3.5 h-3.5 text-primary"
                />
                <span>Próxima programada</span>
              </div>
              <span
                class="font-mono text-xs font-semibold text-text-main block tabular-nums"
              >
                {{ pipeline.nextScheduledSync }}
              </span>
              <span
                class="text-[10px] font-mono text-text-dim block truncate"
                :title="pipeline.scheduleDescription"
              >
                {{ pipeline.scheduleDescription }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        class="w-full flex items-center justify-between gap-3 font-mono text-xs"
      >
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

          <!-- Acciones de control operativas -->
          <template v-if="pipeline">
            <UButton
              v-if="pipeline.status === 'running'"
              size="sm"
              variant="outline"
              color="neutral"
              icon="i-lucide-pause"
              class="text-xs font-semibold cursor-pointer"
              @click="emit('pause', pipeline.id)"
            >
              Pausar
            </UButton>
            <UButton
              v-else-if="pipeline.status === 'paused'"
              size="sm"
              color="primary"
              icon="i-lucide-play"
              class="text-xs font-semibold cursor-pointer text-white"
              @click="emit('resume', pipeline.id)"
            >
              Reanudar
            </UButton>
            <UButton
              v-else
              size="sm"
              variant="outline"
              color="primary"
              icon="i-lucide-refresh-cw"
              class="text-xs font-semibold cursor-pointer"
              @click="emit('trigger-sync', pipeline)"
            >
              Sincronizar ahora
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
