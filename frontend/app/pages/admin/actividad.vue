<script setup lang="ts">
import ActividadAnac from "~/features/actividad/ActividadAnac.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "Actividad ANAC · FlyWise" });
</script>
<template><ActividadAnac /></template>
