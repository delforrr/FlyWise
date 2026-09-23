<script setup lang="ts">
import type { EtlPipeline } from '../types/etl';

interface Props {
  pipeline: EtlPipeline;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'trigger-sync', pipeline: EtlPipeline): void;
  (e: 'pause', id: EtlPipeline['id']): void;
  (e: 'resume', id: EtlPipeline['id']): void;
  (e: 'retry', id: EtlPipeline['id']): void;
  (e: 'view-discarded', pipeline: EtlPipeline): void;
}>();
</script>

<template>
  <div class="p-5 rounded-xl border border-border-subtle bg-surface-card transition-colors flex flex-col justify-between">
    <!-- Cabecera de la tarjeta: Título, Fuente y Badge de Estado -->
    <div>
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg border border-border-subtle bg-surface-accent flex items-center justify-center text-primary flex-shrink-0">
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

        <!-- Badge de Estado Minimalista (Sin glow, bordes nítidos de 1px) -->
        <div>
          <span
            v-if="pipeline.status === 'success'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Al día
          </span>

          <span
            v-else-if="pipeline.status === 'running'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            Sincronizando
          </span>

          <span
            v-else-if="pipeline.status === 'paused'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pausado
          </span>

          <span
            v-else-if="pipeline.status === 'error'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Requiere atención
          </span>

          <span
            v-else
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-accent text-text-muted border border-border-subtle"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-text-dim" />
            En espera
          </span>
        </div>
      </div>

      <!-- Explicación en lenguaje no técnico -->
      <p class="text-xs text-text-muted mt-3 line-clamp-2 leading-relaxed">
        {{ pipeline.description }}
      </p>

      <!-- Barra de Progreso Minimalista Sólida (Visible cuando está corriendo o pausado) -->
      <div v-if="pipeline.status === 'running' || pipeline.status === 'paused'" class="mt-4 pt-3 border-t border-border-subtle/60">
        <div class="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span class="text-text-muted">Progreso de importación</span>
          <span class="font-mono text-text-main font-semibold">
            {{ pipeline.progressPercent }}%
          </span>
        </div>
        <div class="w-full bg-surface-accent h-2 rounded-full overflow-hidden border border-border-subtle/50">
          <div
            class="h-full bg-primary transition-all duration-300 rounded-full"
            :style="{ width: `${pipeline.progressPercent}%` }"
          />
        </div>
        <p class="text-[11px] text-text-dim mt-1.5 font-mono truncate">
          {{ pipeline.currentStepMessage }}
        </p>
      </div>

      <!-- Ficha de Datos Comprensibles -->
      <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border-subtle/60 text-xs">
        <div>
          <span class="text-text-muted block text-[11px]">Filas procesadas</span>
          <span class="font-mono font-semibold text-text-main">
            {{ pipeline.processedRows.toLocaleString() }}
          </span>
        </div>
        <div>
          <span class="text-text-muted block text-[11px]">Registros descartados</span>
          <button
            type="button"
            class="font-mono font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
            :class="pipeline.discardedRows > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted'"
            @click="emit('view-discarded', pipeline)"
          >
            {{ pipeline.discardedRows }}
            <UIcon v-if="pipeline.discardedRows > 0" name="i-lucide-alert-circle" class="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          <span class="text-text-muted block text-[11px]">Última sincronización</span>
          <span class="text-text-main truncate block">
            {{ pipeline.lastSyncAt || 'Sin registros' }}
          </span>
        </div>
        <div>
          <span class="text-text-muted block text-[11px]">Próxima programada</span>
          <span class="text-text-main truncate block">
            {{ pipeline.scheduleDescription }}
          </span>
        </div>
      </div>
    </div>

    <!-- Botones de Acción Operativa Directa -->
    <div class="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
      <!-- Botón secundario para ver descartes -->
      <UButton
        v-if="pipeline.discardedRows > 0"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-file-text"
        class="text-xs font-medium cursor-pointer"
        @click="emit('view-discarded', pipeline)"
      >
        Auditar descartes
      </UButton>
      <span v-else class="text-[11px] text-text-dim flex items-center gap-1">
        <UIcon name="i-lucide-check" class="w-3.5 h-3.5 text-emerald-500" />
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
          class="text-xs font-semibold cursor-pointer"
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
          class="text-xs font-semibold cursor-pointer text-white"
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
          class="text-xs font-semibold cursor-pointer"
          @click="emit('trigger-sync', pipeline)"
        >
          Sincronizar
        </UButton>
      </div>
    </div>
  </div>
</template>
