<script setup lang="ts">
import { es } from "@nuxt/ui/locale";
</script>

<template>
  <UApp :locale="es">
    <!-- Capa fija de filtro grain -->
    <div
      class="fixed inset-0 pointer-events-none z-50 opacity-[0.02] dark:opacity-[0.035] mix-blend-overlay"
      style="background-image: url('data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'noiseFilter\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23noiseFilter)\'/></svg>');"
      aria-hidden="true"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
