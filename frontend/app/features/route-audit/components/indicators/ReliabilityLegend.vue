<template>
  <UCollapsible default-open :unmount-on-hide="false" class="group w-80">
    <UButton
      color="neutral"
      variant="ghost"
      trailing-icon="i-lucide-chevron-down"
      aria-label="Alternar leyenda de confiabilidad OTP-15"
      :ui="{
        trailingIcon:
          'group-data-[state=open]:rotate-180 transition-transform duration-200 text-text-muted group-hover:text-primary',
        base: 'justify-between w-full font-mono text-xs font-bold uppercase tracking-wider',
      }"
      block
      class="btn-hud-secondary px-3.5 py-2.5"
    >
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden="true" />
        <span class="hud-legend">Leyenda Confiabilidad</span>
      </div>
    </UButton>

    <template #content>
      <HudContainer
        variant="box"
        rounded="xl"
        class="mt-2 w-full p-3.5 border border-border-subtle bg-surface-card/95 backdrop-blur-md shadow-md"
      >
        <div
          class="flex flex-col gap-2.5"
          role="list"
          aria-label="Niveles de puntualidad y confiabilidad OTP-15"
        >
          <!-- Nivel Alta: ≥ 85% -->
          <div
            class="flex items-center justify-between gap-2 p-1 rounded-md transition-colors hover:bg-surface-elevated/40"
            role="listitem"
          >
            <OtpBadge message="Alta" />
            <span class="text-[11px] font-medium text-text-muted text-right">
              Alta puntualidad
            </span>
          </div>

          <!-- Nivel Media: 60% – 85% -->
          <div
            class="flex items-center justify-between gap-2 p-1 rounded-md transition-colors hover:bg-surface-elevated/40"
            role="listitem"
          >
            <OtpBadge message="Media" />
            <span class="text-[11px] font-medium text-text-muted text-right">
              Puntualidad moderada
            </span>
          </div>

          <!-- Nivel Baja: < 60% -->
          <div
            class="flex items-start sm:items-center justify-between gap-2 p-1 rounded-md transition-colors hover:bg-surface-elevated/40"
            role="listitem"
          >
            <OtpBadge message="Baja" class="shrink-0" />
            <span class="text-[11px] font-medium text-text-muted text-right leading-tight">
              Baja puntualidad / alta demora
            </span>
          </div>
        </div>

        <!-- Referencia técnica OTP-15 -->
        <div class="pt-2 mt-2 border-t border-border-subtle/50 flex items-center justify-between text-[10px] text-text-muted font-mono">
          <span>Estándar OTP-15</span>
          <span class="text-text-dim">Tolerancia: &le; 15 min</span>
        </div>
      </HudContainer>
    </template>
  </UCollapsible>
</template>
