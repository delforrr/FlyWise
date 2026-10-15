<script setup lang="ts">
import { ref } from "vue";
import type {
  EtlPipeline,
  TargetEntity,
  TriggerSyncOptions,
} from "~/features/etl-monitoring/types/etl";
import { usePipelineCrud } from "~/features/etl-monitoring/composables/usePipelineCrud";
import { useEtlMonitoring } from "~/features/etl-monitoring/composables/useEtlMonitoring";

import EtlServiceManagementHeader from "~/features/etl-monitoring/components/EtlServiceManagementHeader.vue";
import EtlServiceTable from "~/features/etl-monitoring/components/EtlServiceTable.vue";
import EtlPipelineWizardModal from "~/features/etl-monitoring/components/EtlPipelineWizardModal.vue";
import EtlDeleteConfirmModal from "~/features/etl-monitoring/components/EtlDeleteConfirmModal.vue";
import EtlTriggerModal from "~/features/etl-monitoring/components/EtlTriggerModal.vue";

definePageMeta({
  layout: "admin",
});

useSeoMeta({
  title: "FlyWise — Gestión de Servicios y Pipelines ETL",
  description:
    "Catálogo y CRUD de pipelines de ingesta aeronáutica: configuración de endpoints, mapeo y frecuencias de sincronización.",
});

const {
  filteredServices,
  serviceStats,
  selectedEntityFilter,
  selectedSourceTypeFilter,
  searchQuery,
  createPipeline,
  updatePipeline,
  deletePipeline,
  duplicatePipeline,
  togglePipelineStatus,
} = usePipelineCrud();

const { triggerSync } = useEtlMonitoring();

// Estado de modales
const isWizardModalOpen = ref(false);
const pipelineToEdit = ref<EtlPipeline | null>(null);

const isDeleteModalOpen = ref(false);
const pipelineToDelete = ref<EtlPipeline | null>(null);

const isTriggerModalOpen = ref(false);
const pipelineForTrigger = ref<EtlPipeline | null>(null);

function handleOpenCreate() {
  pipelineToEdit.value = null;
  isWizardModalOpen.value = true;
}

function handleOpenEdit(pipeline: EtlPipeline) {
  pipelineToEdit.value = pipeline;
  isWizardModalOpen.value = true;
}

function handleOpenDelete(pipeline: EtlPipeline) {
  pipelineToDelete.value = pipeline;
  isDeleteModalOpen.value = true;
}

function handleOpenTrigger(pipeline: EtlPipeline) {
  pipelineForTrigger.value = pipeline;
  isTriggerModalOpen.value = true;
}

function handleSavePipeline(data: Partial<EtlPipeline>) {
  if (pipelineToEdit.value) {
    updatePipeline(pipelineToEdit.value.id, data);
  } else {
    createPipeline(data);
  }
  isWizardModalOpen.value = false;
}

function handleConfirmDelete(id: string) {
  deletePipeline(id);
  isDeleteModalOpen.value = false;
}

function handleConfirmTrigger(options: TriggerSyncOptions) {
  triggerSync(options);
  isTriggerModalOpen.value = false;
}
</script>

<template>
  <div class="space-y-6">
    <!-- 1. Cabecera y Resumen de Servicios -->
    <EtlServiceManagementHeader
      :stats="serviceStats"
      @create-service="handleOpenCreate"
    />

    <!-- 2. Barra de Filtros y Herramientas -->
    <div
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-surface-card"
    >
      <!-- Filtros por Entidad y Tipo -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Filtro por Entidad -->
        <div class="flex items-center gap-1 text-xs">
          <span class="text-[11px] text-text-muted font-semibold hidden sm:inline">
            Entidad:
          </span>
          <select
            v-model="selectedEntityFilter"
            class="rounded-lg border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todas las Entidades</option>
            <option value="airports">Aeropuertos</option>
            <option value="routes">Rutas</option>
            <option value="otp_metrics">Telemetría OTP</option>
          </select>
        </div>

        <USeparator orientation="vertical" class="h-5 hidden sm:block" />

        <!-- Filtro por Tipo de Origen -->
        <div class="flex items-center gap-1 text-xs">
          <span class="text-[11px] text-text-muted font-semibold hidden sm:inline">
            Origen:
          </span>
          <select
            v-model="selectedSourceTypeFilter"
            class="rounded-lg border border-border-subtle bg-surface-accent px-2.5 py-1.5 text-xs text-text-main font-medium focus:border-primary focus:outline-none"
          >
            <option value="all">Todos los Orígenes</option>
            <option value="system">Fuentes del Sistema</option>
            <option value="custom">Personalizados</option>
          </select>
        </div>
      </div>

      <!-- Buscador por Texto -->
      <div class="w-full lg:w-72">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Buscar por nombre o endpoint..."
          size="sm"
          class="w-full text-xs"
        />
      </div>
    </div>

    <!-- 3. Tabla CRUD de Servicios -->
    <div v-if="filteredServices.length > 0">
      <EtlServiceTable
        :services="filteredServices"
        @edit="handleOpenEdit"
        @duplicate="duplicatePipeline"
        @delete="handleOpenDelete"
        @toggle-status="togglePipelineStatus"
        @trigger-sync="handleOpenTrigger"
      />
    </div>

    <!-- Estado Vacío -->
    <UEmpty
      v-else
      icon="i-lucide-database-zap"
      title="No se encontraron servicios"
      description="Ningún pipeline coincide con los filtros de búsqueda aplicados."
      variant="naked"
      class="p-12 text-center rounded-2xl border border-border-subtle bg-surface-card"
    >
      <template #actions>
        <UButton
          size="xs"
          variant="outline"
          color="primary"
          icon="i-lucide-refresh-cw"
          class="cursor-pointer"
          @click="
            selectedEntityFilter = 'all';
            selectedSourceTypeFilter = 'all';
            searchQuery = '';
          "
        >
          Limpiar Filtros
        </UButton>
      </template>
    </UEmpty>

    <!-- Modales Operativos -->
    <EtlPipelineWizardModal
      :is-open="isWizardModalOpen"
      :pipeline-to-edit="pipelineToEdit"
      @close="isWizardModalOpen = false"
      @save="handleSavePipeline"
    />

    <EtlDeleteConfirmModal
      :is-open="isDeleteModalOpen"
      :pipeline="pipelineToDelete"
      @close="isDeleteModalOpen = false"
      @confirm="handleConfirmDelete"
    />

    <EtlTriggerModal
      :is-open="isTriggerModalOpen"
      :pipeline="pipelineForTrigger"
      @close="isTriggerModalOpen = false"
      @confirm="handleConfirmTrigger"
    />
  </div>
</template>
