<script setup lang="ts">
import OperacionesAdmin from "~/features/vuelos/components/OperacionesAdmin.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "Vuelos · FlyWise" });
</script>
<template><OperacionesAdmin /></template>
