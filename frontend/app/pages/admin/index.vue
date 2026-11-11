<script setup lang="ts">
import type {
  ProcesoEtl,
  TriggerSyncOptions,
} from "~/features/etl-monitoring/types/etl";

definePageMeta({
  layout: "admin",
});

useSeoMeta({
  title: "FlyWise — Centro de Ingesta y Monitoreo ETL",
  description:
    "Monitoreo operativo y supervisión de pipelines de ingesta aeronáutica (OurAirports, OpenFlights, BTS TranStats, ANAC).",
});

const {
  pipelines,
  error,
  logs,
  globalMetrics,
  triggerSync,
  pausePipeline,
  resumePipeline,
  retryFailed,
  syncAll,
  pauseAll,
  clearLogs,
  loadSamples,
} = useEtlMonitoring();

const fallidas = computed(() => pipelines.value.filter(pipeline => pipeline.estado === "error"));

// Estado de modales
const isTriggerModalOpen = ref(false);
const activePipelineForTrigger = ref<ProcesoEtl | null>(null);

const isDiscardedModalOpen = ref(false);
const activePipelineForDiscarded = ref<ProcesoEtl | null>(null);

const isDetailModalOpen = ref(false);
const activePipelineForDetail = ref<ProcesoEtl | null>(null);

function openTriggerModal(proceso: ProcesoEtl) {
  activePipelineForTrigger.value = proceso;
  isTriggerModalOpen.value = true;
}

function handleConfirmTrigger(options: TriggerSyncOptions) {
  triggerSync(options);
  isTriggerModalOpen.value = false;
}

async function openDiscardedModal(proceso: ProcesoEtl) {
  await loadSamples(proceso);
  activePipelineForDiscarded.value = proceso;
  isDiscardedModalOpen.value = true;
}

function openDetailModal(proceso: ProcesoEtl) {
  activePipelineForDetail.value = proceso;
  isDetailModalOpen.value = true;
}

function handleDetailViewDiscarded(proceso: ProcesoEtl) {
  isDetailModalOpen.value = false;
  openDiscardedModal(proceso);
}

function handleDetailTriggerSync(proceso: ProcesoEtl) {
  isDetailModalOpen.value = false;
  openTriggerModal(proceso);
}

function handleRetryDiscarded() {
  if (activePipelineForDiscarded.value) {
    retryFailed(activePipelineForDiscarded.value.id);
    isDiscardedModalOpen.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <UAlert v-if="error" color="error" variant="subtle" title="No se pudo actualizar el monitoreo" :description="error" />
    <EtlHeaderMetrics
      :metricas="globalMetrics"
      @sync-all="syncAll"
      @pause-all="pauseAll"
    />

    <UAlert
      v-for="pipeline in fallidas"
      :key="pipeline.id"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="pipeline.nombre + ' · Ingesta fallida'"
      :description="pipeline.currentStepMessage"
      :actions="[{ label: 'Reintentar', color: 'neutral', variant: 'outline', onClick: () => retryFailed(pipeline.id) }]"
    />

    <section class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">Fuentes</h2>
        <UButton
          to="/admin/servicios"
          variant="outline"
          color="primary"
          size="xs"
          icon="i-lucide-settings"
          class="cursor-pointer font-bold shrink-0 self-start sm:self-auto"
        >
          Gestionar fuentes
        </UButton>
      </div>

      <EtlPipelineList
        :pipelines="pipelines"
        @trigger-sync="openTriggerModal"
        @pause="pausePipeline"
        @resume="resumePipeline"
        @retry="retryFailed"
        @view-discarded="openDiscardedModal"
        @view-detail="openDetailModal"
      />
    </section>

    <section aria-label="Actividad reciente">

      <EtlLiveLogFeed :logs="logs" @clear-logs="clearLogs" />
    </section>

    <!-- Modales Operativos -->
    <EtlPipelineDetailModal
      :is-open="isDetailModalOpen"
      :proceso="activePipelineForDetail"
      @close="isDetailModalOpen = false"
      @trigger-sync="handleDetailTriggerSync"
      @pause="pausePipeline"
      @resume="resumePipeline"
      @view-discarded="handleDetailViewDiscarded"
    />

    <EtlTriggerModal
      :is-open="isTriggerModalOpen"
      :proceso="activePipelineForTrigger"
      @close="isTriggerModalOpen = false"
      @confirm="handleConfirmTrigger"
    />

    <EtlDiscardedModal
      :is-open="isDiscardedModalOpen"
      :proceso="activePipelineForDiscarded"
      @close="isDiscardedModalOpen = false"
      @retry-all="handleRetryDiscarded"
    />
  </div>
</template>
