<script setup lang="ts">
import { ref } from "vue";
import type {
  ProcesoEtl,
  TriggerSyncOptions,
} from "~/features/etl-monitoring/types/etl";
import {
  usePipelineCrud,
  validatePipeline,
} from "~/features/etl-monitoring/composables/usePipelineCrud";
import { useEtlMonitoring } from "~/features/etl-monitoring/composables/useEtlMonitoring";

import EtlServiceManagementHeader from "~/features/etl-monitoring/components/EtlServiceManagementHeader.vue";
import EtlServiceTable from "~/features/etl-monitoring/components/EtlServiceTable.vue";
import EtlPipelineWizardModal from "~/features/etl-monitoring/components/EtlPipelineWizardModal.vue";
import EtlDeleteConfirmModal from "~/features/etl-monitoring/components/EtlDeleteConfirmModal.vue";
import EtlPauseConfirmModal from "~/features/etl-monitoring/components/EtlPauseConfirmModal.vue";
import EtlTriggerModal from "~/features/etl-monitoring/components/EtlTriggerModal.vue";
import EtlOperationsModal from "~/features/etl-monitoring/components/EtlOperationsModal.vue";
import EtlServiceHistoryModal from "~/features/etl-monitoring/components/EtlServiceHistoryModal.vue";
import SourceIdentities from "~/features/etl-monitoring/components/SourceIdentities.vue";

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
const pipelineToEdit = ref<ProcesoEtl | null>(null);
let wizardVersion = 0;
const editarOperacion = ref(false);
const servicioHistorial = ref<ProcesoEtl | null>(null);
const ejecutando = ref(false);
const conflictoActivo = ref<string>();

const isDeleteModalOpen = ref(false);
const pipelineToDelete = ref<ProcesoEtl | null>(null);

const isPauseModalOpen = ref(false);
const pipelineToPause = ref<ProcesoEtl | null>(null);

const isTriggerModalOpen = ref(false);
const pipelineForTrigger = ref<ProcesoEtl | null>(null);

function handleOpenCreate() {
  wizardVersion++;
  pipelineToEdit.value = null;
  isWizardModalOpen.value = true;
}

function handleOpenOperation(proceso: ProcesoEtl | null) {
  pipelineToEdit.value = proceso;
  editarOperacion.value = true;
}

function handleOpenEdit(proceso: ProcesoEtl) {
  if (proceso.operacion) return handleOpenOperation(proceso);
  wizardVersion++;
  pipelineToEdit.value = proceso;
  isWizardModalOpen.value = true;
}

function handleOpenDelete(proceso: ProcesoEtl) {
  pipelineToDelete.value = proceso;
  isDeleteModalOpen.value = true;
}

function handleToggleStatus(target: ProcesoEtl | string) {
  const proceso =
    typeof target === "string"
      ? filteredServices.value.find((p) => p.id === target)
      : target;
  if (!proceso) return;

  if (proceso.estado === "pausado") {
    // Reanudación directa sin diálogo bloqueante
    togglePipelineStatus(proceso.id);
  } else {
    // Pausar requiere confirmación de seguridad
    pipelineToPause.value = proceso;
    isPauseModalOpen.value = true;
  }
}

function handleConfirmPause(id: string) {
  togglePipelineStatus(id);
  isPauseModalOpen.value = false;
  pipelineToPause.value = null;
}

function handleOpenTrigger(proceso: ProcesoEtl) {
  conflictoActivo.value = undefined;
  pipelineForTrigger.value = proceso;
  isTriggerModalOpen.value = true;
}

async function handleSavePipeline(data: Partial<ProcesoEtl>) {
  const validation = validatePipeline(data);
  if (!validation.isValid) {
    return;
  }
  const version = wizardVersion;
  if (pipelineToEdit.value) {
    await updatePipeline(pipelineToEdit.value.id, data);
  } else {
    await createPipeline(data);
  }
  if (version === wizardVersion) isWizardModalOpen.value = false;
}

async function handleConfirmDelete(id: string) {
  await deletePipeline(id);
  isDeleteModalOpen.value = false;
}

async function handleConfirmTrigger(options: TriggerSyncOptions) {
  if (ejecutando.value) return;
  ejecutando.value = true;
  conflictoActivo.value = undefined;
  try {
    await triggerSync(options);
    isTriggerModalOpen.value = false;
  } catch (error) {
    if (error && typeof error === 'object' && 'data' in error) {
      const data = error.data as { ejecucionId?: string } | undefined;
      conflictoActivo.value = data?.ejecucionId;
    }
  } finally {
    ejecutando.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 1. Cabecera y Resumen de Servicios -->
    <EtlServiceManagementHeader
      :stats="serviceStats"
      @create-service="handleOpenCreate"
      @create-operation="handleOpenOperation(null)"
    />

    <div class="grid gap-4 rounded-lg bg-surface-card p-4 sm:grid-cols-3 sm:p-5">
      <UFormField label="Entidad">
        <USelect v-model="selectedEntityFilter" class="w-full" :items="[
          { label: 'Todas', value: 'all' }, { label: 'Aeropuertos', value: 'aeropuertos' },
          { label: 'Rutas', value: 'rutas' }, { label: 'Países', value: 'paises' },
          { label: 'Aerolíneas', value: 'aerolineas' }, { label: 'OTP', value: 'otp_metrics' },
        ]" />
      </UFormField>
      <UFormField label="Origen">
        <USelect v-model="selectedSourceTypeFilter" class="w-full" :items="[
          { label: 'Todos', value: 'all' }, { label: 'Del sistema', value: 'system' },
          { label: 'Personalizados', value: 'custom' },
        ]" />
      </UFormField>
      <UFormField label="Buscar">
        <UInput v-model="searchQuery" icon="i-lucide-search" placeholder="Nombre o URL" class="w-full" />
      </UFormField>
    </div>

    <!-- 3. Tabla CRUD de Servicios -->
    <div v-if="filteredServices.length > 0">
      <EtlServiceTable
        :services="filteredServices"
        @edit="handleOpenEdit"
        @duplicate="duplicatePipeline"
        @delete="handleOpenDelete"
        @toggle-status="handleToggleStatus"
        @trigger-sync="handleOpenTrigger"
        @history="servicioHistorial = $event"
      />
    </div>

    <!-- Estado Vacío -->
    <UEmpty
      v-else
      icon="i-lucide-database-zap"
      title="No se encontraron servicios"
      description="Ningún proceso coincide con los filtros de búsqueda aplicados."
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
    <SourceIdentities />
    <UButton to="/admin/bts#bts-identities" variant="link" color="neutral">Correspondencias BTS</UButton>
    <EtlOperationsModal
      v-if="editarOperacion"
      :servicio="pipelineToEdit"
      @close="editarOperacion = false"
    />
    <EtlServiceHistoryModal
      v-if="servicioHistorial"
      :servicio="servicioHistorial"
      @close="servicioHistorial = null"
    />
    <EtlPipelineWizardModal
      :is-open="isWizardModalOpen"
      :pipeline-to-edit="pipelineToEdit"
      @close="isWizardModalOpen = false"
      @save="handleSavePipeline"
    />

    <EtlDeleteConfirmModal
      :is-open="isDeleteModalOpen"
      :proceso="pipelineToDelete"
      @close="isDeleteModalOpen = false"
      @confirm="handleConfirmDelete"
    />

    <EtlPauseConfirmModal
      :is-open="isPauseModalOpen"
      :proceso="pipelineToPause"
      @close="isPauseModalOpen = false"
      @confirm="handleConfirmPause"
    />

    <EtlTriggerModal
      :is-open="isTriggerModalOpen"
      :proceso="pipelineForTrigger"
      :busy="ejecutando"
      :conflicto-activo="conflictoActivo"
      @close="isTriggerModalOpen = false"
      @confirm="handleConfirmTrigger"
    />
  </div>
</template>
