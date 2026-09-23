<script setup lang="ts">
import type { EtlGlobalMetrics } from '../types/etl';

interface Props {
  metrics: EtlGlobalMetrics;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'sync-all'): void;
  (e: 'pause-all'): void;
}>();
</script>

<template>
  <div class="space-y-4">
    <!-- Barra superior de título y acciones globales -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-subtle">
      <div>
        <div class="flex items-center gap-2.5">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-accent border border-border-subtle text-primary">
            <UIcon name="i-lucide-database-zap" class="w-5 h-5" />
          </span>
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-text-main">
              Centro de Ingesta y Monitoreo ETL
            </h1>
            <p class="text-xs sm:text-sm text-text-muted mt-0.5">
              Supervisión operativa y sincronización de fuentes aeronáuticas abiertas.
            </p>
          </div>
        </div>
      </div>

      <!-- Acciones de control global -->
      <div class="flex items-center gap-2.5 self-start sm:self-auto">
        <UButton
          icon="i-lucide-pause"
          color="neutral"
          variant="outline"
          size="md"
          class="rounded-lg text-xs font-semibold px-3 py-2 cursor-pointer hover:bg-surface-accent"
          @click="emit('pause-all')"
        >
          Pausar Todo
        </UButton>
        <UButton
          icon="i-lucide-play"
          color="primary"
          size="md"
          class="rounded-lg text-xs font-semibold px-3.5 py-2 cursor-pointer text-white"
          @click="emit('sync-all')"
        >
          Sincronizar Todo
        </UButton>
      </div>
    </div>

    <!-- Grilla de 4 KPIs Sólidos (Sin glow, sin degradados, sin blur) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <!-- 1. Estado General -->
      <div class="p-4 rounded-xl border border-border-subtle bg-surface-card">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">Estado del Sistema</span>
          <UIcon name="i-lucide-activity" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5 flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :class="{
              'bg-emerald-500': metrics.systemHealth === 'optimal',
              'bg-sky-500 animate-pulse': metrics.systemHealth === 'syncing',
              'bg-rose-500': metrics.systemHealth === 'attention_needed',
            }"
          />
          <span class="text-lg font-bold text-text-main">
            {{
              metrics.systemHealth === 'optimal'
                ? 'Operativo y al día'
                : metrics.systemHealth === 'syncing'
                  ? 'Sincronizando'
                  : 'Requiere atención'
            }}
          </span>
        </div>
        <p class="text-xs text-text-muted mt-1">
          Último chequeo: {{ metrics.lastGlobalSync }}
        </p>
      </div>

      <!-- 2. Registros Aeronáuticos -->
      <div class="p-4 rounded-xl border border-border-subtle bg-surface-card">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">Registros Almacenados</span>
          <UIcon name="i-lucide-layers" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5">
          <span class="text-2xl font-bold font-mono tracking-tight text-text-main">
            {{ metrics.totalAeroRecords.toLocaleString() }}
          </span>
        </div>
        <p class="text-xs text-text-muted mt-1">
          Aeropuertos, rutas y telemetría
        </p>
      </div>

      <!-- 3. Tareas en Curso -->
      <div class="p-4 rounded-xl border border-border-subtle bg-surface-card">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">Procesos Activos</span>
          <UIcon name="i-lucide-cpu" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="text-2xl font-bold font-mono text-text-main">
            {{ metrics.activeJobsCount }}
          </span>
          <span class="text-xs text-text-muted">en ejecución</span>
        </div>
        <p class="text-xs text-text-muted mt-1">
          Lotes procesándose en segundo plano
        </p>
      </div>

      <!-- 4. Calidad y Descartes -->
      <div class="p-4 rounded-xl border border-border-subtle bg-surface-card">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-text-muted">Tasa de Confiabilidad</span>
          <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {{ metrics.successRatePercent }}%
          </span>
          <span class="text-xs text-text-muted">éxito</span>
        </div>
        <p class="text-xs text-text-muted mt-1">
          {{ metrics.totalDiscardedCount.toLocaleString() }} descartes para auditoría
        </p>
      </div>
    </div>
  </div>
</template>
