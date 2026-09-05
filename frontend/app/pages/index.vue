<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Visualización de confiabilidad histórica y métricas de aerolíneas en tiempo real.",
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden flex flex-col">
    <LayoutHeader />

    <main class="relative flex-1 overflow-hidden p-3 sm:p-6">
      <HudWrapper />
    </main>
  </div>
</template>
