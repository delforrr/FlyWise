<script setup lang="ts">
import AdministracionCatalogo from "~/features/catalogos/components/AdministracionCatalogo.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "Aerolíneas · FlyWise" });
</script>

<template>
  <AdministracionCatalogo recurso="aerolineas" titulo="Aerolíneas" />
</template>
