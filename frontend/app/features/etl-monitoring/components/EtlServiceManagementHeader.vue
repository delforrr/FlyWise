<script setup lang="ts">
interface Props {
  stats: {
    total: number;
    systemCount: number;
    customCount: number;
    activeCount: number;
    errorCount: number;
  };
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "create-service"): void;
}>();
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Fuentes de ingesta</h1>
      <UButton color="neutral" icon="i-lucide-plus" @click="emit('create-service')">Nueva fuente</UButton>
    </header>
    <p class="text-sm text-text-muted tabular-nums">
      {{ stats.total }} fuentes · {{ stats.systemCount }} del sistema · {{ stats.customCount }} personalizadas · {{ stats.activeCount }} activas · {{ stats.errorCount }} con error
    </p>
  </div>
</template>
