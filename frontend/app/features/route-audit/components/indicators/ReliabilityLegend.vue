<template>
  <UCollapsible default-open :unmount-on-hide="false" class="group w-80">
    <UButton
      color="neutral"
      variant="ghost"
      trailing-icon="i-lucide-chevron-down"
      :ui="{
        trailingIcon:
          'group-data-[state=open]:rotate-180 transition-transform duration-200 text-text-muted group-hover:text-primary',
        base: 'justify-between w-full font-mono text-xs font-bold uppercase tracking-wider',
      }"
      block
      class="btn-hud-secondary px-3.5 py-2.5"
    >
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
        <span class="hud-legend">Leyenda</span>
      </div>
    </UButton>

    <template #content>
      <HudContainer variant="box" rounded="xl" class="mt-2 w-full p-4">
        <div class="flex flex-col gap-3">
          <OtpBadge message="Alta" />
          <OtpBadge message="Media" />
          <OtpBadge message="Baja" />
        </div>
      </HudContainer>
    </template>
  </UCollapsible>
</template>
