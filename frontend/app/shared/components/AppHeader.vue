<script setup lang="ts">
import type { HudHeaderNav } from "~/types/hud";

interface Props {
  hasControls?: boolean;
  navs?: HudHeaderNav[];
  hasLogin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hasControls: false,
  navs: () => [],
  hasLogin: false,
});
</script>

<template>
  <UHeader
    title="FlyWise"
    :toggle="false"
    :ui="{
      root: 'mt-2 sm:mt-4 sticky top-2 sm:top-4 z-50 mx-3 sm:mx-6 rounded-2xl bg-white/95 dark:bg-surface-base/85 backdrop-blur-2xl border border-slate-300/90 dark:border-border-subtle shadow-[0_10px_25px_-5px_rgba(15,23,42,0.10),0_4px_6px_-2px_rgba(15,23,42,0.04)] dark:shadow-2xl transition-all duration-400 h-auto',
      container:
        'w-full max-w-none px-3.5 sm:px-6 py-2 sm:py-2.5 flex flex-wrap md:flex-nowrap items-center justify-between gap-3',
      left: 'flex-none flex items-center gap-3',
      center: 'hidden md:flex flex-1 items-center justify-center',
      right: 'flex-none flex items-center justify-end gap-2 sm:gap-3',
    }"
  >
    <!-- Logo & Título de Precisión Aeronáutica -->
    <template #title>
      <NuxtLink to="/" class="flex flex-col cursor-pointer group">
        <span class="flex flex-row items-center gap-2 sm:gap-2.5">
          <span
            class="font-display font-bold text-xl sm:text-2xl text-text-main tracking-tight group-hover:text-primary transition-colors"
          >
            FlyWise
          </span>
        </span>
        <p
          class="text-[11px] font-mono text-text-muted hidden sm:block tracking-tight"
        >
          ¡Auditá tu próximo vuelo!
        </p>
      </NuxtLink>
    </template>

    <template #default>
      <FromToDate v-if="hasControls" class="hidden md:flex" />
      <div v-if="navs?.length" class="flex items-center gap-1.5 sm:gap-2">
        <UButton
          v-for="nav in navs"
          :key="nav.text"
          :to="nav.to"
          :icon="nav.icon"
          size="md"
          variant="ghost"
          class="rounded-xl font-medium text-xs sm:text-sm text-text-muted hover:text-text-main hover:bg-slate-100 dark:hover:bg-surface-accent transition-all active:scale-[0.98]"
        >
          {{ nav.text }}
        </UButton>
      </div>
    </template>

    <template #right>
      <ScenarioSelector v-if="hasControls" />
      <ThemeToggle />
      <UButton
        v-if="hasLogin"
        icon="i-lucide-user"
        size="md"
        variant="ghost"
        to="/login"
        class="rounded-xl font-semibold text-xs sm:text-sm text-text-main hover:text-primary hover:bg-slate-100 dark:hover:bg-surface-accent border border-slate-300 dark:border-border-subtle/60 transition-all active:scale-[0.98]"
        aria-label="Acceso administrativo"
        label="Acceso Admin"
      />
    </template>
  </UHeader>
</template>
