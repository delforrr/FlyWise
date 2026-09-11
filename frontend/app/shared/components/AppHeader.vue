<template>
  <UHeader
    title="FlyWise"
    :toggle="false"
    :ui="{
      root: 'mt-2 sm:mt-4 sticky top-2 sm:top-4 z-50 mx-3 sm:mx-6 rounded-xl bg-surface-base/80 backdrop-blur-xl border border-border-subtle shadow-xl transition-all duration-300 h-auto',
      container:
        'w-full max-w-none px-4 sm:px-6 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-3',
      left: 'flex-none flex items-center gap-3',
      center: 'hidden md:flex flex-1 items-center justify-center',
      right: 'flex-none flex items-center justify-end gap-2 sm:gap-3',
    }"
  >
    <!-- Logo & Título -->
    <template #title>
      <div class="flex flex-col">
        <span class="flex flex-row items-center gap-3">
          <h1 class="hud-title text-xl sm:text-2xl">FlyWise</h1>
          <UBadge variant="outline" class="rounded-full" label="v1.0" />
        </span>
        <p class="text-xs text-text-muted hidden sm:block">
          ¡Auditá tu próximo vuelo!
        </p>
      </div>
    </template>

    <template #default>
      <FromToDate class="hidden md:flex" />
    </template>

    <template #right>
      <ScenarioSelector />
      <ThemeToggle />
    </template>
  </UHeader>
</template>
