<script setup lang="ts">
import EurocontrolPanel from "~/features/indicadores/components/EurocontrolPanel.vue";
definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "FlyWise — Indicadores EUROCONTROL" });
</script>
<template>
  <div class="space-y-4">
    <UButton to="/admin/actividad" color="neutral" variant="outline" icon="i-lucide-chart-column">
      Actividad aeroportuaria
    </UButton>
    <EurocontrolPanel />
  </div>
</template>
