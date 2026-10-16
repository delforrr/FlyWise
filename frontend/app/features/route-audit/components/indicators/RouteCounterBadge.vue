<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  count: number;
}>();

const titleText = computed(() =>
  props.count === 1
    ? "1 ruta coincide con tu búsqueda"
    : `${props.count} rutas coinciden con tu búsqueda`,
);

const ariaLabel = computed(() =>
  props.count === 1 ? "1 ruta disponible" : `${props.count} rutas disponibles`,
);
</script>

<template>
  <UBadge
    color="primary"
    variant="subtle"
    icon="i-lucide-route"
    role="status"
    :aria-label="ariaLabel"
    :title="titleText"
    class="font-mono tabular-nums font-semibold shrink-0"
  >
    {{ count }}
  </UBadge>
</template>
