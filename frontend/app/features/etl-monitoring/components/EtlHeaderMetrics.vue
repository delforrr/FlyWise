<script setup lang="ts">
import { ref } from "vue";
import type { EtlGlobalMetrics } from "../types/etl";
import AnimatedCounter from "~/shared/components/ui/AnimatedCounter.vue";

interface Props {
  metrics: EtlGlobalMetrics;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "sync-all"): void;
  (e: "pause-all"): void;
}>();

const isConfirmSyncAllOpen = ref(false);

function confirmSyncAll() {
  emit("sync-all");
  isConfirmSyncAllOpen.value = false;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Barra superior de título y acciones globales -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border-subtle"
    >
      <div>
        <div class="flex items-center gap-2.5">
          <span
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-xs"
          >
            <UIcon name="i-lucide-database-zap" class="w-5 h-5" />
          </span>
          <div>
            <div class="flex items-center gap-2">
              <h1
                class="text-xl sm:text-2xl font-bold font-mono tracking-tight text-text-main uppercase"
              >
                Panel de Administración
              </h1>
            </div>
            <p class="text-xs text-text-muted mt-0.5">
              Supervisión y Gestión de Información Aeronáutica de fuentes
              externas
            </p>
          </div>
        </div>
      </div>

      <!-- Acciones de control global -->
      <div class="flex items-center gap-2.5 self-start sm:self-auto font-mono">
        <UButton
          icon="i-lucide-pause"
          color="neutral"
          variant="outline"
          size="sm"
          class="rounded-lg text-xs font-semibold px-3 py-1.5 cursor-pointer hover:bg-surface-accent border-border-subtle"
          @click="emit('pause-all')"
        >
          Pausar Todo
        </UButton>
        <UButton
          icon="i-lucide-play"
          color="primary"
          size="sm"
          class="rounded-lg text-xs font-bold px-3.5 py-1.5 cursor-pointer text-white shadow-xs"
          @click="isConfirmSyncAllOpen = true"
        >
          Sincronizar Todo
        </UButton>
      </div>
    </div>

    <!-- Grilla de 4 KPIs Sólidos (Estilo Swiss Minimalist, bordes nítidos de 1px) -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-feature-tech"
    >
      <!-- 1. Estado General -->
      <div
        class="p-4 rounded-xl border border-border-subtle border-t-white/30 dark:border-t-white/10 bg-surface-card shadow-xs flex flex-col justify-between"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-medium text-text-muted uppercase tracking-wider font-mono"
          >
            Estado del Sistema
          </span>
          <UIcon
            :name="
              metrics.systemHealth === 'optimal'
                ? 'i-lucide-shield-check'
                : metrics.systemHealth === 'syncing'
                  ? 'i-lucide-refresh-cw'
                  : 'i-lucide-alert-triangle'
            "
            class="w-4 h-4"
            :class="{
              'text-emerald-500': metrics.systemHealth === 'optimal',
              'text-sky-500 animate-spin': metrics.systemHealth === 'syncing',
              'text-rose-500': metrics.systemHealth === 'attention_needed',
            }"
          />
        </div>
        <div class="mt-2.5 flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="{
              'bg-emerald-500': metrics.systemHealth === 'optimal',
              'bg-sky-500 animate-pulse': metrics.systemHealth === 'syncing',
              'bg-rose-500': metrics.systemHealth === 'attention_needed',
            }"
          />
          <span class="text-base font-bold text-text-main truncate">
            {{
              metrics.systemHealth === "optimal"
                ? "Operativo y al día"
                : metrics.systemHealth === "syncing"
                  ? "Sincronizando lotes"
                  : "Requiere atención"
            }}
          </span>
        </div>
        <p class="text-[11px] text-text-dim mt-2 font-mono tabular-nums">
          Último chequeo: {{ metrics.lastGlobalSync }}
        </p>
      </div>

      <!-- 2. Registros Aeronáuticos -->
      <div
        class="p-4 rounded-xl border border-border-subtle border-t-white/30 dark:border-t-white/10 bg-surface-card shadow-xs flex flex-col justify-between"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-medium text-text-muted uppercase tracking-wider font-mono"
          >
            Registros Almacenados
          </span>
          <UIcon name="i-lucide-database" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5">
          <AnimatedCounter
            :value="metrics.totalAeroRecords"
            format-locale
            class="text-2xl font-bold font-mono tabular-nums text-text-main tracking-tight"
          />
        </div>
        <p class="text-[11px] text-text-dim mt-2 font-mono truncate">
          Aeropuertos, rutas y telemetría
        </p>
      </div>

      <!-- 3. Tareas en Curso -->
      <div
        class="p-4 rounded-xl border border-border-subtle border-t-white/30 dark:border-t-white/10 bg-surface-card shadow-xs flex flex-col justify-between"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-medium text-text-muted uppercase tracking-wider font-mono"
          >
            Procesos Activos
          </span>
          <UIcon name="i-lucide-cpu" class="w-4 h-4 text-text-muted" />
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <AnimatedCounter
            :value="metrics.activeJobsCount"
            class="text-2xl font-bold font-mono tabular-nums text-text-main tracking-tight"
          />
          <span class="text-xs text-text-muted font-mono"
            >/ 4 workers asignados</span
          >
        </div>
        <div class="mt-2">
          <UProgress
            :model-value="(metrics.activeJobsCount / 4) * 100"
            size="xs"
            color="primary"
            class="h-1.5 rounded-full"
          />
        </div>
      </div>

      <!-- 4. Calidad y Descartes -->
      <div
        class="p-4 rounded-xl border border-border-subtle border-t-white/30 dark:border-t-white/10 bg-surface-card shadow-xs flex flex-col justify-between"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-medium text-text-muted uppercase tracking-wider font-mono"
          >
            Tasa de Confiabilidad
          </span>
          <UIcon
            name="i-lucide-check-circle-2"
            class="w-4 h-4 text-emerald-500"
          />
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <AnimatedCounter
            :value="metrics.successRatePercent"
            suffix="%"
            class="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight"
          />
          <span class="text-xs text-text-muted font-mono">éxito global</span>
        </div>
        <p class="text-[11px] text-text-dim mt-2 font-mono tabular-nums">
          {{ metrics.totalDiscardedCount.toLocaleString() }} filas descartadas
        </p>
      </div>
    </div>

    <!-- Modal de Confirmación para Sincronización Global -->
    <UModal
      v-model:open="isConfirmSyncAllOpen"
      title="Confirmar Sincronización Global de Fuentes"
      description="Esta acción iniciará la ingesta concurrente en los 4 pipelines activos."
      :ui="{
        content:
          'sm:max-w-md bg-surface-card border border-border-subtle rounded-2xl shadow-2xl',
      }"
    >
      <template #body>
        <div class="space-y-3 text-xs text-text-muted">
          <p>
            Se generarán trabajos en las colas de <strong>BullMQ</strong> para:
          </p>
          <ul class="list-disc list-inside space-y-1 font-mono text-text-main">
            <li>OurAirports Open Data (Aeropuertos y pistas)</li>
            <li>OpenFlights Global Routes (Rutas y conexiones)</li>
            <li>BTS TranStats (Telemetría de puntualidad OTP-15)</li>
            <li>ANAC Argentina (Vuelos comerciales de cabotaje)</li>
          </ul>
        </div>
      </template>

      <template #footer>
        <div
          class="flex items-center justify-end gap-2 w-full font-mono text-xs"
        >
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            @click="isConfirmSyncAllOpen = false"
          >
            Cancelar
          </UButton>
          <UButton
            color="primary"
            size="sm"
            class="text-white font-bold"
            @click="confirmSyncAll"
          >
            Iniciar Sincronización
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
