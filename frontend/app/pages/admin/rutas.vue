<script setup lang="ts">
import AdministracionCatalogo from "~/features/catalogos/components/AdministracionCatalogo.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "Rutas · FlyWise" });
</script>

<template>
  <AdministracionCatalogo recurso="rutas" titulo="Rutas" />
</template>
