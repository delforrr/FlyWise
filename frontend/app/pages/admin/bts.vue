<script setup lang="ts">
import BtsPanel from "~/features/bts/components/BtsPanel.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "BTS mensual · FlyWise" });
</script>
<template><BtsPanel /></template>
