<script setup lang="ts">
useSeoMeta({
  title: "FlyWise — Iniciar Sesión",
  description: "Acceso administrativo al sistema FlyWise.",
});
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-background relative overflow-x-hidden"
  >
    <!-- 1. Capa de Fondo Ambiental Global (Móvil y Desktop) -->
    <div
      class="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute -top-28 -left-28 w-96 h-96 sm:w-120 sm:h-120 md:w-152 md:h-152 rounded-full bg-radial from-primary/20 via-primary/8 to-transparent dark:from-primary/20 dark:via-primary/5 dark:to-transparent blur-3xl opacity-75 dark:opacity-85 animate-pulse duration-8000"
      />
      <div
        class="absolute -bottom-28 -right-28 w-96 h-96 sm:w-120 sm:h-120 md:w-152 md:h-152 rounded-full bg-radial from-secondary/15 via-secondary/8 to-transparent dark:from-secondary/18 dark:via-secondary/5 dark:to-transparent blur-3xl opacity-70 dark:opacity-80"
      />
      <div
        class="absolute inset-0 bg-radial-[at_top_center] from-primary/6 via-transparent to-transparent dark:from-primary/10 dark:via-transparent dark:to-transparent"
      />
      <!-- Malla técnica geodésica de micro-puntos (dot-matrix scrim calibrada para titanium slate) -->
      <div
        class="absolute inset-0 bg-[radial-gradient(rgba(15,23,42,0.14)_1.25px,transparent_1.25px)] dark:bg-[radial-gradient(rgba(255,255,255,0.08)_1.25px,transparent_1.25px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_at_top,black_55%,transparent_90%)]"
      />
    </div>

    <!-- 2. Estructura de Contenido -->
    <div class="relative z-10 flex flex-col min-h-screen">
      <AppHeader />

      <main
        class="flex-1 w-full max-w-7xl xl:max-w-350 2xl:max-w-375 mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12 items-center justify-center px-4 sm:px-6 lg:px-10 xl:px-14 py-4 lg:py-0"
      >
        <!-- Columna Izquierda: Hero con Radar Lateral Asimétrico Sutil Detrás -->
        <div
          class="relative w-full lg:col-span-7 flex items-center justify-center"
        >
          <!-- Radar HUD Lateral Asimétrico Sutil (~580px) -->
          <div
            class="hidden lg:flex absolute lg:-top-8 lg:-left-12 pointer-events-none z-0 items-center justify-center overflow-visible opacity-45 dark:opacity-35 transition-opacity duration-700 lg:w-145 lg:h-145"
            aria-hidden="true"
          >
            <RadarBackground class="w-full h-full" />
          </div>

          <AppHero class="w-full relative z-10" />
        </div>

        <div
          class="w-full lg:col-span-5 flex items-center justify-center relative z-10"
        >
          <LoginForm class="w-full max-w-lg lg:max-w-none" />
        </div>
      </main>

      <AppFooter />
    </div>
  </div>
</template>
