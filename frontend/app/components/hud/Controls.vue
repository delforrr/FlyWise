<template>
  <HudPill vertical interactive class="p-1.5 sm:p-2 w-auto items-center">
    <!-- Botón Info Leyenda OTP (Visible en móviles encima de los controles de mapa) -->
    <div class="md:hidden flex flex-col items-center w-full">
      <UPopover
        arrow
        :content="{ side: 'left', align: 'start', sideOffset: 8 }"
      >
        <UButton
          icon="i-lucide-info"
          color="neutral"
          variant="ghost"
          size="sm"
          title="Leyenda Confiabilidad OTP"
          aria-label="Ver leyenda de confiabilidad OTP"
          class="text-aero-cyan hover:text-aero-cyan/80 transition-colors"
        />

        <template #content>
          <div
            class="w-64 p-3 bg-surface-elevated/95 backdrop-blur-xl border border-border-subtle rounded-xl shadow-2xl flex flex-col gap-2.5 select-none"
          >
            <!-- Cabecera de la Leyenda -->
            <div
              class="flex items-center gap-2 pb-1.5 border-b border-border-subtle/60"
            >
              <div
                class="w-2 h-2 rounded-full bg-aero-cyan animate-pulse shrink-0"
              />
              <div class="flex flex-col min-w-0">
                <span
                  class="text-xs font-bold font-mono text-text-main uppercase tracking-wider truncate"
                >
                  Leyenda Confiabilidad OTP
                </span>
                <span class="text-[10px] text-text-muted truncate">
                  Retraso ≤ 15 min del horario programado
                </span>
              </div>
            </div>

            <!-- Badges de Confiabilidad -->
            <div class="flex flex-col gap-2">
              <HudOtpBadge message="Alta" />
              <HudOtpBadge message="Media" />
              <HudOtpBadge message="Baja" />
            </div>
          </div>
        </template>
      </UPopover>

      <USeparator class="w-full opacity-60 my-1" size="xs" />
    </div>

    <!-- Sección Superior: Controles de Zoom -->
    <div class="flex flex-col gap-1.5 sm:gap-2 items-center">
      <HudControlButton type="zoomIn" />
      <HudControlButton type="zoomOut" />
    </div>

    <USeparator class="w-full opacity-60 my-1" size="xs" />

    <!-- Sección Inferior: Acciones -->
    <div class="flex flex-col gap-1.5 sm:gap-2 items-center">
      <HudControlButton type="toggle3D" />
      <HudControlButton type="fitRoute" />
    </div>
  </HudPill>
</template>
