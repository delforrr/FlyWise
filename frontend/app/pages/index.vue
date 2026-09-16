<script setup lang="ts">
import type { HudHeaderNav } from "~/types/hud";

useSeoMeta({
  title: "FlyWise — Inteligencia Aeronáutica y Puntualidad",
  description:
    "Análisis de demoras, puntualidad OTP-15 y red global de rutas aéreas.",
});

const navs: HudHeaderNav[] = [
  {
    text: "Explorador Global",
    icon: "i-lucide-globe",
    to: "/explorar",
  },
  {
    text: "Métricas",
    icon: "i-lucide-circle-help",
    to: "#",
  },
];
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background overflow-x-hidden">
    <AppHeader :navs="navs" :has-login="true" />

    <main
      class="flex-1 w-full px-4 sm:px-6 lg:px-10 xl:px-16 py-6 lg:py-0 flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12 items-center justify-center"
    >
      <div
        class="w-full lg:col-span-7 flex items-center justify-center py-2 sm:py-4 lg:py-8"
      >
        <AppHero class="w-full" />
      </div>

      <div
        class="w-full lg:col-span-5 flex items-center justify-center py-2 sm:py-4 lg:py-8"
      >
        <HeroInput class="w-full max-w-lg lg:max-w-none" />
      </div>
    </main>
  </div>
</template>
