<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background overflow-x-hidden">
    <AppHeader />

    <main
      class="flex-1 w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-4 sm:py-6 lg:py-0 pb-12 sm:pb-16 lg:pb-0 flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12 items-center justify-center"
    >
      <div class="w-full lg:col-span-7 flex items-center justify-center py-2 sm:py-4 lg:py-8">
        <AppHero class="w-full" />
      </div>

      <div class="w-full lg:col-span-5 flex items-center justify-center py-2 sm:py-4 lg:py-8">
        <LoginForm class="w-full max-w-lg lg:max-w-none" />
      </div>
    </main>

    <AppFooter />
  </div>
</template>
