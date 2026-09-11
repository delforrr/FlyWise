<script setup lang="ts">
import type { TestScenario } from "~/data/seedData";

defineProps<{
  scenario: TestScenario;
  isActive: boolean;
}>();

const emit = defineEmits<{
  (e: "select", scenario: TestScenario): void;
}>();
</script>

<template>
  <button
    class="w-full text-left p-2.5 rounded-lg text-xs transition-all duration-150 flex flex-col gap-1 hover:bg-surface-card border"
    :class="[
      isActive
        ? 'bg-aero-cyan/10 border-aero-cyan/40 text-text-main'
        : 'border-transparent text-text-muted hover:text-text-main'
    ]"
    @click="emit('select', scenario)"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-semibold text-text-main flex items-center gap-1.5">
        {{ scenario.title }}
      </span>
      <UBadge
        size="xs"
        variant="subtle"
        :color="scenario.badgeColor ?? 'primary'"
        class="text-[10px] font-mono shrink-0"
      >
        {{ scenario.badgeText }}
      </UBadge>
    </div>
    <p class="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
      {{ scenario.description }}
    </p>
  </button>
</template>
