<script setup lang="ts">
import { TEST_SCENARIOS, type TestScenario } from "~/data/seedData";

const {
  applyScenario,
  activeScenarioId,
  selectedOrigin,
  selectedDestination,
  triggerFit,
} = useFlightSelection();

function selectScenario(scenario: TestScenario) {
  applyScenario(scenario);
  nextTick(() => {
    triggerFit();
  });
}

function isScenarioActive(scenario: TestScenario): boolean {
  return (
    activeScenarioId.value === scenario.id ||
    (scenario.originIata === selectedOrigin.value &&
      scenario.destinationIata === selectedDestination.value)
  );
}
</script>

<template>
  <UPopover arrow>
    <UButton
      icon="i-lucide-sparkles"
      variant="subtle"
      color="primary"
      size="sm"
      class="btn-hud-secondary rounded-xl text-xs font-medium gap-1.5 shadow-sm"
      aria-label="Probar escenarios preconfigurados"
    >
      <span class="hidden md:inline">Escenarios</span>
      <UIcon name="i-lucide-chevron-down" class="w-3.5 h-3.5 opacity-70" />
    </UButton>

    <template #content>
      <div class="w-80 sm:w-96 p-2 bg-surface-elevated/95 backdrop-blur-xl border border-border-subtle rounded-xl shadow-2xl flex flex-col gap-1 select-none">
        <div class="px-2.5 py-1.5 border-b border-border-subtle/50 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-text-main font-mono">
            <UIcon name="i-lucide-flask-conical" class="w-4 h-4 text-primary" />
            <span>Escenarios de Prueba (Mock Data)</span>
          </div>
          <span class="text-[10px] text-text-muted font-mono">
            {{ TEST_SCENARIOS.length }} disponibles
          </span>
        </div>

        <div class="flex flex-col gap-1 max-h-80 overflow-y-auto p-1 hud-scrollable">
          <ScenarioCard
            v-for="scenario in TEST_SCENARIOS"
            :key="scenario.id"
            :scenario="scenario"
            :is-active="isScenarioActive(scenario)"
            @select="selectScenario"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
