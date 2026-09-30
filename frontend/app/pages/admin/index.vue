<script setup lang="ts">
import type {
  EtlPipeline,
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
  logs,
  globalMetrics,
  triggerSync,
  pausePipeline,
  resumePipeline,
  retryFailed,
  syncAll,
  pauseAll,
  clearLogs,
  resolveDiscardedSample,
} = useEtlMonitoring();

// Estado de modales
const isTriggerModalOpen = ref(false);
const activePipelineForTrigger = ref<EtlPipeline | null>(null);

const isDiscardedModalOpen = ref(false);
const activePipelineForDiscarded = ref<EtlPipeline | null>(null);

const isDetailModalOpen = ref(false);
const activePipelineForDetail = ref<EtlPipeline | null>(null);

function openTriggerModal(pipeline: EtlPipeline) {
  activePipelineForTrigger.value = pipeline;
  isTriggerModalOpen.value = true;
}

function handleConfirmTrigger(options: TriggerSyncOptions) {
  triggerSync(options);
  isTriggerModalOpen.value = false;
}

function openDiscardedModal(pipeline: EtlPipeline) {
  activePipelineForDiscarded.value = pipeline;
  isDiscardedModalOpen.value = true;
}

function openDetailModal(pipeline: EtlPipeline) {
  activePipelineForDetail.value = pipeline;
  isDetailModalOpen.value = true;
}

function handleDetailViewDiscarded(pipeline: EtlPipeline) {
  isDetailModalOpen.value = false;
  openDiscardedModal(pipeline);
}

function handleDetailTriggerSync(pipeline: EtlPipeline) {
  isDetailModalOpen.value = false;
  openTriggerModal(pipeline);
}

function handleResolveDiscarded(recordId: string) {
  if (activePipelineForDiscarded.value) {
    resolveDiscardedSample(activePipelineForDiscarded.value.id, recordId);
  }
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
    <!-- 1. KPIs Globales de Salud y Controles Maestros -->
    <EtlHeaderMetrics
      :metrics="globalMetrics"
      @sync-all="syncAll"
      @pause-all="pauseAll"
    />

    <!-- 2. Sección Principal: Pipelines por Fuente -->
    <section class="space-y-4">
      <div>
        <h2 class="text-base font-bold text-text-main">Fuentes de Datos</h2>
        <p class="text-xs text-text-muted mt-0.5">
          Control individual de sincronización, frecuencias programadas y
          auditoría de integridad.
        </p>
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

    <!-- 3. Registro y Consola de Auditoría en Vivo -->
    <section class="space-y-4 pt-2 border-t border-border-subtle">
      <div>
        <h2 class="text-base font-bold text-text-main">
          Auditoría de Eventos en Tiempo Real
        </h2>
        <p class="text-xs text-text-muted mt-0.5">
          Trazabilidad de lotes procesados, descartes detectados y actividades
          de los workers.
        </p>
      </div>

      <EtlLiveLogFeed :logs="logs" @clear-logs="clearLogs" />
    </section>

    <!-- Modales Operativos -->
    <EtlPipelineDetailModal
      :is-open="isDetailModalOpen"
      :pipeline="activePipelineForDetail"
      @close="isDetailModalOpen = false"
      @trigger-sync="handleDetailTriggerSync"
      @pause="pausePipeline"
      @resume="resumePipeline"
      @view-discarded="handleDetailViewDiscarded"
    />

    <EtlTriggerModal
      :is-open="isTriggerModalOpen"
      :pipeline="activePipelineForTrigger"
      @close="isTriggerModalOpen = false"
      @confirm="handleConfirmTrigger"
    />

    <EtlDiscardedModal
      :is-open="isDiscardedModalOpen"
      :pipeline="activePipelineForDiscarded"
      @close="isDiscardedModalOpen = false"
      @resolve="handleResolveDiscarded"
      @retry-all="handleRetryDiscarded"
    />
  </div>
</template>
