<template>
  <HudPill
    vertical
    interactive
    class="p-1 sm:p-1.5 w-auto items-center shadow-2xl border border-border-subtle/80 border-t-white/30 dark:border-t-white/15 bg-surface-card/90 dark:bg-surface-base/85 backdrop-blur-xl"
  >
    <!-- Botón Info Leyenda OTP (Visible en móviles: despliega hacia la izquierda por fuera del panel de controles) -->
    <div class="md:hidden flex flex-col items-center w-full">
      <UPopover
        :content="{ side: 'left', align: 'start', sideOffset: 12 }"
        portal
      >
        <UButton
          icon="i-lucide-info"
          color="neutral"
          variant="ghost"
          title="Leyenda OTP"
          aria-label="Ver leyenda de confiabilidad OTP"
          class="relative flex items-center justify-center w-10 h-10 min-w-10 min-h-10 p-0 rounded-xl text-primary hover:text-primary hover:bg-surface-accent/80 border border-transparent hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200"
        />

        <template #content>
          <div
            class="w-68 p-3.5 bg-surface-elevated/95 backdrop-blur-xl border border-border-subtle/90 rounded-2xl shadow-2xl flex flex-col gap-2.5 select-none"
          >
            <!-- Cabecera de la Leyenda -->
            <div
              class="flex items-center gap-2 pb-2 border-b border-border-subtle/60"
            >
              <div
                class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"
              />
              <div class="flex flex-col min-w-0">
                <span
                  class="text-xs font-bold font-mono text-text-main uppercase tracking-wider truncate"
                >
                  Leyenda OTP
                </span>
                <span class="text-[10px] text-text-muted truncate">
                  Retraso ≤ 15 min del horario programado
                </span>
              </div>
            </div>

            <!-- Badges de Confiabilidad con doble codificación sensorial -->
            <div class="flex flex-col gap-2">
              <OtpBadge message="Alta" />
              <OtpBadge message="Media" />
              <OtpBadge message="Baja" />
            </div>
          </div>
        </template>
      </UPopover>

      <USeparator class="w-6 opacity-60 my-1 border-t border-border-subtle" size="xs" />
    </div>

    <!-- Clúster de Instrumentación: Grupo de Zoom (+ / -) -->
    <div
      class="flex flex-col gap-1 sm:gap-1.5 items-center"
      role="group"
      aria-label="Controles de zoom de mapa"
    >
      <UTooltip text="Acercar mapa (+)" :content="{ side: 'left' }">
        <ControlButton type="zoomIn" />
      </UTooltip>
      <UTooltip text="Alejar mapa (-)" :content="{ side: 'left' }">
        <ControlButton type="zoomOut" />
      </UTooltip>
    </div>

    <!-- Micro-separador de Cabina -->
    <USeparator class="w-6 opacity-60 my-1 border-t border-border-subtle" size="xs" />

    <!-- Clúster de Instrumentación: Grupo de Vista (3D / Rumbo Norte / Encuadre de Ruta) -->
    <div
      class="flex flex-col gap-1 sm:gap-1.5 items-center"
      role="group"
      aria-label="Controles de orientación y encuadre"
    >
      <UTooltip text="Alternar perspectiva 2D / 3D" :content="{ side: 'left' }">
        <ControlButton type="toggle3D" />
      </UTooltip>
      <UTooltip text="Restablecer orientación al norte" :content="{ side: 'left' }">
        <ControlButton type="resetNorth" />
      </UTooltip>
      <UTooltip text="Encuadrar ruta seleccionada" :content="{ side: 'left' }">
        <ControlButton type="fitRoute" />
      </UTooltip>
    </div>

    <!-- Micro-separador de Cabina -->
    <USeparator class="w-6 opacity-60 my-1 border-t border-border-subtle" size="xs" />

    <!-- Clúster de Instrumentación: Manual de Atajos de Cabina -->
    <div
      class="flex flex-col items-center"
      role="group"
      aria-label="Manual de atajos y ayuda"
    >
      <UTooltip text="Manual de atajos (?)" :content="{ side: 'left' }">
        <ControlButton type="shortcuts" />
      </UTooltip>
    </div>
  </HudPill>
</template>
