<script setup lang="ts">
import { computed } from "vue";
import type { EtlPipeline } from "../types/etl";

interface Props {
  pipeline: EtlPipeline;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "trigger-sync", pipeline: EtlPipeline): void;
  (e: "pause", id: EtlPipeline["id"]): void;
  (e: "resume", id: EtlPipeline["id"]): void;
  (e: "retry", id: EtlPipeline["id"]): void;
  (e: "view-discarded", pipeline: EtlPipeline): void;
}>();

// Formateo de tiempo de ejecución estimado según filas y velocidad promedio
const executionTimeFormatted = computed<string | null>(() => {
  if (!props.pipeline.averageSpeedRowsPerSec || props.pipeline.averageSpeedRowsPerSec <= 0) {
    return null;
  }
  const totalSeconds = Math.round(props.pipeline.processedRows / props.pipeline.averageSpeedRowsPerSec);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
});

// Tasa porcentual de registros descartados
const errorRateFormatted = computed<string>(() => {
  if (!props.pipeline.processedRows || props.pipeline.processedRows <= 0) return "0.00%";
  const rate = (props.pipeline.discardedRows / props.pipeline.processedRows) * 100;
  return `${rate.toFixed(2)}%`;
});
</script>

<template>
  <UCard class="flex flex-col justify-between h-full bg-surface-card border-border-subtle">
    <!-- Cabecera de la tarjeta: Título, Fuente y Badge de Estado -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-lg border border-border-subtle bg-surface-accent flex items-center justify-center text-primary shrink-0"
          >
            <UIcon :name="pipeline.icon" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-text-main leading-tight">
              {{ pipeline.name }}
            </h3>
            <span class="text-xs font-medium text-text-muted">
              {{ pipeline.datasetName }}
            </span>
          </div>
        </div>

        <!-- Badges de Estado con bordes nítidos de 1px, pulso sutil y contraste limpio -->
        <div class="shrink-0">
          <UBadge
            v-if="pipeline.status === 'success'"
            color="success"
            variant="subtle"
            size="sm"
            class="gap-1.5 border border-emerald-500/30 dark:border-emerald-500/40 select-none font-mono tabular-nums text-xs"
          >
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-25" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Al día
          </UBadge>

          <UBadge
            v-else-if="pipeline.status === 'running'"
            color="info"
            variant="subtle"
            size="sm"
            class="gap-1.5 border border-sky-500/30 dark:border-sky-500/40 select-none font-mono tabular-nums text-xs"
          >
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            Sincronizando
          </UBadge>

          <UBadge
            v-else-if="pipeline.status === 'paused'"
            color="warning"
            variant="subtle"
            size="sm"
            class="gap-1.5 border border-amber-500/30 dark:border-amber-500/40 select-none font-mono tabular-nums text-xs"
          >
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Pausado
          </UBadge>

          <UBadge
            v-else-if="pipeline.status === 'error'"
            color="error"
            variant="subtle"
            size="sm"
            class="gap-1.5 border border-rose-500/30 dark:border-rose-500/40 select-none font-mono tabular-nums text-xs"
          >
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-50" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            Error
          </UBadge>

          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            size="sm"
            class="gap-1.5 border border-border-subtle/80 select-none font-mono tabular-nums text-xs"
          >
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="relative inline-flex rounded-full h-2 w-2 bg-neutral-400" />
            </span>
            En espera
          </UBadge>
        </div>
      </div>

      <!-- Explicación -->
      <p class="text-xs text-text-muted mt-3 line-clamp-2 leading-relaxed">
        {{ pipeline.description }}
      </p>

      <!-- Barra de Progreso Nuxt UI (Visible cuando está corriendo o pausado) -->
      <div
        v-if="pipeline.status === 'running' || pipeline.status === 'paused'"
        class="mt-4 pt-3 border-t border-border-subtle/60"
      >
        <div
          class="flex items-center justify-between text-xs mb-1.5 font-medium"
        >
          <span class="text-text-muted">Progreso de importación</span>
          <span class="font-mono tabular-nums text-text-main font-semibold">
            {{ pipeline.progressPercent }}%
          </span>
        </div>
        <UProgress
          :model-value="pipeline.progressPercent"
          color="primary"
          size="sm"
        />
        <p class="text-[11px] text-text-dim mt-1.5 font-mono tabular-nums truncate">
          {{ pipeline.currentStepMessage }}
        </p>
      </div>

      <!-- Ficha de Datos Numéricos con alineación tabular estable -->
      <div
        class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border-subtle/60 text-xs"
      >
        <div>
          <span class="text-text-muted block text-[11px]"
            >Filas procesadas</span
          >
          <span class="font-mono tabular-nums font-semibold text-text-main block">
            {{ pipeline.processedRows.toLocaleString() }}
          </span>
          <span
            v-if="executionTimeFormatted"
            class="text-[10px] text-text-dim block font-mono tabular-nums mt-0.5"
            :title="`Velocidad media: ${pipeline.averageSpeedRowsPerSec.toLocaleString()} filas/segundo`"
          >
            Tiempo: ~{{ executionTimeFormatted }} · {{ pipeline.averageSpeedRowsPerSec.toLocaleString() }} fil/s
          </span>
        </div>

        <div>
          <span class="text-text-muted block text-[11px]"
            >Registros descartados</span
          >
          <button
            type="button"
            class="font-mono tabular-nums font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card rounded px-1 -mx-1 transition-colors transform-gpu"
            :class="
              pipeline.discardedRows > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-text-muted'
            "
            @click="emit('view-discarded', pipeline)"
          >
            <span>{{ pipeline.discardedRows.toLocaleString() }}</span>
            <UIcon
              v-if="pipeline.discardedRows > 0"
              name="i-lucide-alert-circle"
              class="w-3.5 h-3.5 shrink-0"
            />
          </button>
          <span
            class="text-[10px] text-text-dim block font-mono tabular-nums mt-0.5"
          >
            {{ pipeline.discardedRows === 0 ? '0.00% descartes' : `${errorRateFormatted} descartes` }}
          </span>
        </div>

        <div>
          <span class="text-text-muted block text-[11px]"
            >Última sincronización</span
          >
          <span class="text-text-main truncate block font-mono tabular-nums text-xs">
            {{ pipeline.lastSyncAt || "Sin registros" }}
          </span>
        </div>

        <div>
          <span class="text-text-muted block text-[11px]"
            >Próxima programada</span
          >
          <span class="text-text-main truncate block font-mono tabular-nums text-xs">
            {{ pipeline.scheduleDescription }}
          </span>
        </div>
      </div>
    </div>

    <!-- Botones de Acción Operativa Directa con anillos de foco y sin desplazamientos -->
    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full">
        <!-- Botón secundario para ver descartes -->
        <UButton
          v-if="pipeline.discardedRows > 0"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-file-text"
          class="text-xs font-medium cursor-pointer transform-gpu transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
          @click="emit('view-discarded', pipeline)"
        >
          Auditar descartes
        </UButton>
        <span v-else class="text-[11px] text-text-dim flex items-center gap-1 font-mono tabular-nums">
          <UIcon name="i-lucide-check" class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          Sin errores
        </span>

        <!-- Acciones de control -->
        <div class="flex items-center gap-1.5">
          <!-- Pausar si está corriendo -->
          <UButton
            v-if="pipeline.status === 'running'"
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-pause"
            class="text-xs font-semibold cursor-pointer transform-gpu transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
            @click="emit('pause', pipeline.id)"
          >
            Pausar
          </UButton>

          <!-- Reanudar si está pausado -->
          <UButton
            v-else-if="pipeline.status === 'paused'"
            size="xs"
            color="primary"
            icon="i-lucide-play"
            class="text-xs font-semibold cursor-pointer text-white transform-gpu transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
            @click="emit('resume', pipeline.id)"
          >
            Reanudar
          </UButton>

          <!-- Sincronizar bajo demanda si está idle o success -->
          <UButton
            v-else
            size="xs"
            variant="outline"
            color="primary"
            icon="i-lucide-refresh-cw"
            class="text-xs font-semibold cursor-pointer transform-gpu transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
            @click="emit('trigger-sync', pipeline)"
          >
            Sincronizar
          </UButton>
        </div>
      </div>
    </template>
  </UCard>
</template>

