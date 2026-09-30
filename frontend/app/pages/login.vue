<script setup lang="ts">
definePageMeta({
  layout: "hero-split",
});

useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <LoginForm class="w-full max-w-lg lg:max-w-none" />
</template>
