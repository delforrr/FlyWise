<script setup lang="ts">
import AdministracionCatalogo from "~/features/catalogos/components/AdministracionCatalogo.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "Aeropuertos · FlyWise" });
</script>

<template>
  <AdministracionCatalogo recurso="aeropuertos" titulo="Aeropuertos" />
</template>
