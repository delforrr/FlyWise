<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  count: number;
}>();

const titleText = computed(() =>
  props.count === 1
    ? "1 ruta coincide con tu búsqueda"
    : `${props.count} rutas coinciden con tu búsqueda`
);

const ariaLabel = computed(() =>
  props.count === 1
    ? "1 ruta disponible"
    : `${props.count} rutas disponibles`
);
</script>

<template>
  <div
    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border border-primary/25 bg-primary/10 text-primary select-none shrink-0 shadow-2xs hud-counter-badge"
    role="status"
    :aria-label="ariaLabel"
    :title="titleText"
  >
    <UIcon name="i-lucide-route" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    <span class="font-mono tabular-nums font-semibold">{{ count }}</span>
  </div>
</template>
