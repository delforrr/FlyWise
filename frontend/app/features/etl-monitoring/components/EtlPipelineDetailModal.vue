<script setup lang="ts">
import { computed } from "vue";
import type { ProcesoEtl } from "../types/etl";

interface Props {
  isOpen: boolean;
  proceso: ProcesoEtl | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "trigger-sync", proceso: ProcesoEtl): void;
  (e: "pause", id: ProcesoEtl["id"]): void;
  (e: "resume", id: ProcesoEtl["id"]): void;
  (e: "view-discarded", proceso: ProcesoEtl): void;
}>();

// Formateo del tiempo estimado de ejecución según filas y velocidad
const executionTimeFormatted = computed<string | null>(() => {
  if (
    !props.proceso?.averageSpeedRowsPerSec ||
    props.proceso.averageSpeedRowsPerSec <= 0
  ) {
    return null;
  }
  const totalSeconds = Math.round(
    props.proceso.filasProcesadas / props.proceso.averageSpeedRowsPerSec,
  );
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
});

// Tasa porcentual de registros descartados
const errorRateFormatted = computed<string>(() => {
  const processed = props.proceso?.filasProcesadas ?? 0;
  const discarded = props.proceso?.filasDescartadas ?? 0;
  const attempted = processed + discarded;
  return `${(attempted ? 100 * discarded / attempted : 0).toFixed(2)}%`;
});
</script>

<template>
  <UModal
    :open="isOpen && !!proceso"
    :title="`Detalle de Fuente — ${proceso?.nombre ?? ''}`"
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
      <div v-if="proceso" class="space-y-4 font-feature-tech text-xs">
        <!-- 1. Cabecera Informativa de la Fuente -->
        <div
          class="p-3.5 rounded-xl bg-surface-accent/70 border border-border-subtle flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="w-10 h-10 rounded-lg bg-surface-accent border border-border-subtle flex items-center justify-center text-primary shrink-0"
            >
              <UIcon :name="proceso.icon" class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-text-main text-sm truncate">
                  {{ proceso.nombre }}
                </span>
                <span class="font-mono text-[11px] text-text-muted">
                  #{{ proceso.id }}
                </span>
              </div>
              <span
                class="text-[11px] font-mono text-text-muted block truncate"
              >
                {{ proceso.nombreConjunto }}
              </span>
              <p
                class="text-[11px] text-text-dim mt-1 line-clamp-2 leading-relaxed"
              >
                {{ proceso.descripcion }}
              </p>
            </div>
          </div>

          <!-- Estado actual del proceso -->
          <div class="shrink-0">
            <UBadge
              v-if="proceso.estado === 'success'"
              color="success"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-emerald-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Al día
            </UBadge>
            <UBadge
              v-else-if="proceso.estado === 'running'"
              color="info"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-sky-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
              Sincronizando
            </UBadge>
            <UBadge
              v-else-if="proceso.estado === 'pausado'"
              color="warning"
              variant="subtle"
              size="sm"
              class="gap-1.5 border border-amber-500/30 font-mono tabular-nums text-[11px]"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Pausado
            </UBadge>
            <UBadge
              v-else-if="proceso.estado === 'error'"
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
          v-if="proceso.estado === 'running' || proceso.estado === 'pausado'"
          class="p-3 rounded-xl border border-border-subtle bg-surface-card space-y-1.5"
        >
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span class="text-text-muted">Progreso de importación</span>
            <span class="font-bold text-text-main tabular-nums">
              {{ proceso.estado === 'running' ? "Total pendiente" : `${proceso.progressPercent}%` }}
            </span>
          </div>
          <UProgress
            :model-value="proceso.estado === 'running' ? null : proceso.progressPercent"
            size="xs"
            color="primary"
            class="h-1.5 rounded-full"
          />
          <p
            v-if="proceso.currentStepMessage"
            class="text-[11px] text-text-dim font-mono truncate pt-0.5"
          >
            {{ proceso.currentStepMessage }}
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
                  {{ proceso.filasProcesadas.toLocaleString() }}
                </span>
                <span class="text-[10px] text-text-dim font-mono block mt-1">
                  de ~{{ proceso.totalEstimatedRows.toLocaleString() }}
                  estimadas
                </span>
              </div>
              <div
                class="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[10px] font-mono text-text-muted"
              >
                <span>Velocidad media:</span>
                <span class="tabular-nums font-semibold text-text-main">
                  ~{{ proceso.averageSpeedRowsPerSec.toLocaleString() }} fil/s
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
                    proceso.filasDescartadas > 0
                      ? 'i-lucide-alert-circle'
                      : 'i-lucide-check-circle'
                  "
                  class="w-4 h-4"
                  :class="
                    proceso.filasDescartadas > 0
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
                      proceso.filasDescartadas > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-text-main'
                    "
                  >
                    {{ proceso.filasDescartadas.toLocaleString() }}
                  </span>
                  <span class="text-[10px] font-mono text-text-dim">
                    ({{ errorRateFormatted }})
                  </span>
                </div>
                <span
                  class="text-[10px] font-mono block mt-1"
                  :class="
                    proceso.filasDescartadas > 0
                      ? 'text-amber-600/80 dark:text-amber-400/80'
                      : 'text-emerald-600 dark:text-emerald-400'
                  "
                >
                  {{
                    proceso.filasDescartadas > 0
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
                  v-if="proceso.filasDescartadas > 0"
                  variant="link"
                  color="warning"
                  size="xs"
                  class="p-0 text-[10px] font-bold cursor-pointer underline"
                  @click="emit('view-discarded', proceso)"
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
                {{ proceso.lastSyncAt || "Sin registros previos" }}
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
                {{ proceso.nextScheduledSync }}
              </span>
              <span
                class="text-[10px] font-mono text-text-dim block truncate"
                :title="proceso.scheduleDescription"
              >
                {{ proceso.scheduleDescription }}
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
          <template v-if="proceso">
            <UButton
              v-if="proceso.estado === 'running' && !proceso.pausado"
              size="sm"
              variant="outline"
              color="neutral"
              icon="i-lucide-pause"
              class="text-xs font-semibold cursor-pointer"
              @click="emit('pause', proceso.id)"
            >
              Pausar programación
            </UButton>
            <UButton
              v-else-if="proceso.pausado"
              size="sm"
              color="primary"
              icon="i-lucide-play"
              class="text-xs font-semibold cursor-pointer text-white"
              @click="emit('resume', proceso.id)"
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
              @click="emit('trigger-sync', proceso)"
            >
              Sincronizar ahora
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
