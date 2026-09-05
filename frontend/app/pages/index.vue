<template>
  <div class="relative h-screen w-screen overflow-hidden flex flex-col">
    <Header />

    <main class="relative flex-1 overflow-hidden p-3 sm:p-6">
      <ReliabilityLegend />
      <HudControls/>
    </main>
  </div>
</template>

<script setup lang="ts">
import ReliabilityLegend from "~/components/hud/ReliabilityLegend.vue";
import Header from "~/components/layout/Header.vue";

useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Visualización de confiabilidad histórica y métricas de aerolíneas en tiempo real.",
});
</script>
