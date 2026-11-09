<script setup lang="ts">
import BtsPanel from '~/features/bts/components/BtsPanel.vue';
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] });
</script>
<template><BtsPanel /></template>
