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
  (e: "create-operation"): void;
}>();
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Servicios de ingesta</h1>
      <div class="flex flex-wrap gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-plus" @click="emit('create-service')">Nuevo catálogo CSV</UButton>
        <UButton color="neutral" icon="i-lucide-plus" @click="emit('create-operation')">Nuevo servicio de operaciones</UButton>
      </div>
    </header>
    <p class="text-sm text-text-muted tabular-nums">
      {{ stats.total }} fuentes · {{ stats.systemCount }} del sistema · {{ stats.customCount }} personalizadas · {{ stats.activeCount }} activas · {{ stats.errorCount }} con error
    </p>
  </div>
</template>
