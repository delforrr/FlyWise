<script setup lang="ts">
import { ref } from "vue";
import type { EtlGlobalMetrics } from "../types/etl";

interface Props {
  metricas: EtlGlobalMetrics;
}

defineProps<Props>();

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
  <div class="space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Monitoreo de ingestas</h1>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-pause" color="neutral" variant="outline" @click="emit('pause-all')">Pausar todo</UButton>
        <UButton icon="i-lucide-play" color="neutral" @click="isConfirmSyncAllOpen = true">Sincronizar todo</UButton>
      </div>
    </header>
    <UCard variant="subtle" :ui="{ body: 'p-0 sm:p-0' }">
      <dl class="grid grid-cols-2 lg:grid-cols-4">
        <div class="p-4 border-b border-r border-border-subtle lg:border-b-0">
          <dt class="text-sm text-text-muted">Estado de ingestas</dt>
          <dd class="mt-1 font-semibold">{{ metricas.systemHealth === "optimal" ? "Al día" : metricas.systemHealth === "syncing" ? "En ejecución" : "Requiere atención" }}</dd>
        </div>
        <div class="p-4 border-b border-border-subtle lg:border-b-0 lg:border-r">
          <dt class="text-sm text-text-muted">Ejecuciones activas</dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums">{{ metricas.activeJobsCount }}</dd>
        </div>
        <div class="p-4 border-r border-border-subtle">
          <dt class="text-sm text-text-muted">Filas procesadas</dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums">{{ metricas.totalAeroRecords.toLocaleString("es-AR") }}</dd>
        </div>
        <div class="p-4">
          <dt class="text-sm text-text-muted">Filas descartadas</dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums">{{ metricas.totalDiscardedCount.toLocaleString("es-AR") }}</dd>
        </div>
      </dl>
    </UCard>
    <UModal v-model:open="isConfirmSyncAllOpen" title="Sincronizar fuentes"
      description="Se encolarán los catálogos habilitados. Las ejecuciones activas terminarán primero.">
      <template #footer>
        <UButton variant="ghost" color="neutral" @click="isConfirmSyncAllOpen = false">Cancelar</UButton>
        <UButton color="neutral" @click="confirmSyncAll">Iniciar sincronización</UButton>
      </template>
    </UModal>
  </div>
</template>
