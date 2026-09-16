<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background relative overflow-x-hidden">
    <!-- 1. Capa de Fondo Ambiental Global (Móvil y Desktop) -->
    <div
      class="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute -top-24 -left-24 w-80 h-80 sm:w-96 sm:h-96 md:w-[32rem] md:h-[32rem] rounded-full bg-primary/10 dark:bg-primary/15 blur-3xl"
      />
      <div
        class="absolute -bottom-24 -right-24 w-80 h-80 sm:w-96 sm:h-96 md:w-[32rem] md:h-[32rem] rounded-full bg-secondary/10 dark:bg-secondary/15 blur-3xl"
      />
      <div
        class="absolute inset-0 bg-radial-[at_top_center] from-primary/5 via-transparent to-transparent"
      />
    </div>

    <!-- 2. Estructura de Contenido -->
    <div class="relative z-10 flex flex-col min-h-screen">
      <AppHeader />

      <main
        class="flex-1 w-full flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12 items-center justify-center px-4 sm:px-6 lg:px-12 xl:px-16 py-4 lg:py-0"
      >
        <!-- Columna Izquierda: Hero con Radar Centrado Detrás en Desktop -->
        <div class="relative w-full lg:col-span-7 flex items-center justify-center">
          <!-- Radar HUD Exclusivo Desktop: Centrado simétricamente detrás del Hero -->
          <div
            class="hidden lg:flex absolute inset-0 -m-8 xl:-m-12 pointer-events-none z-0 items-center justify-center overflow-hidden opacity-35 dark:opacity-50"
            aria-hidden="true"
          >
            <RadarBackground class="w-full h-full max-w-[720px] max-h-[720px]" />
          </div>

          <AppHero class="w-full relative z-10" />
        </div>

        <div class="w-full lg:col-span-5 flex items-center justify-center relative z-10">
          <LoginForm class="w-full max-w-lg lg:max-w-none" />
        </div>
      </main>

      <AppFooter />
    </div>
  </div>
</template>
