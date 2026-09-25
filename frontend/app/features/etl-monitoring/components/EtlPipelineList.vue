<script setup lang="ts">
import { ref, computed } from "vue";
import type { EtlPipeline } from "../types/etl";
import EtlPipelineCard from "./EtlPipelineCard.vue";

interface Props {
  pipelines: EtlPipeline[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "trigger-sync", pipeline: EtlPipeline): void;
  (e: "pause", id: EtlPipeline["id"]): void;
  (e: "resume", id: EtlPipeline["id"]): void;
  (e: "retry", id: EtlPipeline["id"]): void;
  (e: "view-discarded", pipeline: EtlPipeline): void;
}>();
import EtlPipelineNavigator from "./EtlPipelineNavigator.vue";

const currentFilter = ref<"all" | "running" | "success" | "has_issues">("all");
const searchQuery = ref("");

const filteredPipelines = computed(() => {
  return props.pipelines.filter((p) => {
    if (currentFilter.value === "running" && p.status !== "running")
      return false;
    if (currentFilter.value === "success" && p.status !== "success")
      return false;
    if (
      currentFilter.value === "has_issues" &&
      p.discardedRows === 0 &&
      p.status !== "error"
    )
      return false;

    if (searchQuery.value.trim() !== "") {
      const q = searchQuery.value.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDataset = p.datasetName.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      if (!matchName && !matchDataset && !matchDesc) return false;
    }

    return true;
  });
});

const counts = computed(() => ({
  all: props.pipelines.length,
  running: props.pipelines.filter((p) => p.status === "running").length,
  success: props.pipelines.filter((p) => p.status === "success").length,
  has_issues: props.pipelines.filter(
    (p) => p.discardedRows > 0 || p.status === "error",
  ).length,
}));

const filterTabs = computed(() => [
  { label: "Todos", value: "all", count: counts.value.all },
  { label: "En ejecución", value: "running", count: counts.value.running },
  { label: "Al día", value: "success", count: counts.value.success },
  {
    label: "Con descartes",
    value: "has_issues",
    count: counts.value.has_issues,
  },
]);
</script>

<template>
  <div class="space-y-4">
    <!-- Barra de Herramientas: Pestañas de filtro y Búsqueda rápida -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <!-- Pestañas de estado -->
      <EtlPipelineNavigator v-model="currentFilter" :items="filterTabs" />

      <!-- Buscador por nombre o dataset -->
      <div class="w-full sm:w-64">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Buscar fuente..."
          size="md"
          class="w-full rounded-lg text-xs"
        />
      </div>
    </div>

    <!-- Grilla de Pipelines -->
    <div
      v-if="filteredPipelines.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      <EtlPipelineCard
        v-for="p in filteredPipelines"
        :key="p.id"
        :pipeline="p"
        @trigger-sync="emit('trigger-sync', $event)"
        @pause="emit('pause', $event)"
        @resume="emit('resume', $event)"
        @retry="emit('retry', $event)"
        @view-discarded="emit('view-discarded', $event)"
      />
    </div>

    <!-- Estado vacío cuando el filtro no arroja resultados -->
    <UEmpty
      v-else
      icon="i-lucide-inbox"
      title="No se encontraron pipelines"
      description="Ningún dataset coincide con los criterios de búsqueda o filtro seleccionados."
      variant="naked"
      class="p-8 text-center rounded-xl border border-border-subtle bg-surface-card"
    />
  </div>
</template>
