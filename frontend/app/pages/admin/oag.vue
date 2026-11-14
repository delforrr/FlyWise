<script setup lang="ts">
import OagPanel from '~/features/oag/components/OagPanel.vue';
definePageMeta({ layout: 'admin', middleware: 'administrador' });
useSeoMeta({ title: 'Carga de OTP con OAG · FlyWise' });
</script>

<template><OagPanel /></template>
