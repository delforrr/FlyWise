<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <AppHeader />

  <UPage
    class="min-h-screen"
    :ui="{
      root: 'min-h-screen lg:grid lg:grid-cols-12 lg:gap-0',
      center: 'hidden',
      left: 'hidden lg:flex lg:col-span-7 items-center justify-center p-8',
      right:
        'lg:col-span-5 flex items-center justify-center w-full min-h-screen p-6 bg-accent',
    }"
  >
    <template #left>
      <div class="hidden lg:flex h-full w-full items-center justify-center">
        <AppHero />
      </div>
    </template>

    <template #right>
      <div
        class="flex flex-col items-center justify-center w-full h-full min-h-screen bg-accent"
      >
        <HeroInput />
        <!-- <LoginForm /> -->
      </div>
    </template>
  </UPage>
</template>
