<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <UPage
    class="min-h-screen"
    :ui="{
      root: 'min-h-screen lg:grid lg:grid-cols-2 lg:gap-0',
      center: 'hidden',
      left: 'hidden lg:flex lg:col-span-1 items-center justify-center',
      right:
        'lg:col-start-2 lg:col-span-1 flex items-center justify-center w-full min-h-screen p-4 bg-accent',
    }"
  >
    <template #left>
      <div class="hidden lg:flex h-full w-full items-center justify-center">
        <!-- Espacio para branding, ilustración o logo de FlyWise -->
      </div>
    </template>

    <template #right>
      <div
        class="flex flex-col items-center justify-center w-full h-full min-h-screen bg-accent"
      >
        <LoginForm />
      </div>
    </template>
  </UPage>
</template>
