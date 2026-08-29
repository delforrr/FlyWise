<template>
  <UHeader
    title="FlyWise"
    :toggle="false"
    :ui="{
      root: 'mt-4 sticky top-4 z-50 mx-3 sm:mx-6 rounded-2xl bg-surface-base/80 backdrop-blur-xl border border-border-subtle shadow-xl transition-all duration-300 h-auto',
      container:
        'w-full max-w-none px-6 py-3 flex items-center justify-between',
    }"
  >
    <!-- Logo & Título -->
    <template #title>
      <div class="flex flex-col">
        <span class="flex flex-row items-center gap-3">
          <h1 class="hud-title text-2xl">FlyWise</h1>
          <UBadge variant="outline" class="rounded-full" label="v1.0" />
        </span>
        <p class="text-xs text-text-muted">¡Auditá tu próximo vuelo!</p>
      </div>
    </template>

    <template #default>
        <div class=""></div>
    </template>
  </UHeader>
</template>
