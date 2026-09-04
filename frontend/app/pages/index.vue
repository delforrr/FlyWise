<template>
  <div><Header /></div>

  <main></main>
  <footer></footer>
</template>

<script setup lang="ts">
import Header from "~/components/layout/Header.vue";

useSeoMeta({
  title: "FlyWise — Explorador Global de Rutas y Puntualidad",
  description:
    "Visualización de confiabilidad histórica y métricas de aerolíneas en tiempo real.",
});
</script>
