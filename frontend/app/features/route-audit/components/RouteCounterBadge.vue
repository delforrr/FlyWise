<script setup lang="ts">
defineProps<{
  count: number;
}>();
</script>

<template>
  <div
    class="hidden lg:flex hud-counter-badge"
    :title="`${count} rutas coinciden con tu búsqueda`"
  >
    <UIcon name="i-lucide-route" class="w-3.5 h-3.5" />
    <span>{{ count }}</span>
  </div>
</template>
