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
    text: "Métricas Consideradas",
    icon: "i-lucide-circle-help",
    to: "#",
  },
];
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <AppHeader :navs="navs" :has-login="true" />

    <UPage
      class="flex-1"
      :ui="{
        root: 'lg:grid lg:grid-cols-12 lg:gap-0 flex-1',
        center: 'hidden',
        left: 'hidden lg:flex lg:col-span-7 items-center justify-center p-8',
        right:
          'lg:col-span-5 flex items-center justify-center w-full min-h-[calc(100vh-5rem)] p-6 bg-accent',
      }"
    >
      <template #left>
        <div class="hidden lg:flex h-full w-full items-center justify-center">
          <AppHero />
        </div>
      </template>

      <template #right>
        <div
          class="flex flex-col items-center justify-center w-full h-full p-4 bg-accent"
        >
          <HeroInput />
        </div>
      </template>
    </UPage>
  </div>
</template>
