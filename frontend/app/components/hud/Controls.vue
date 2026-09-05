<template>
  <HudPill vertical width="w-56" interactive class="p-2">
    <!-- Sección Superior: Controles de Zoom -->
    <div class="flex flex-col gap-2">
      <HudControlButton type="zoomIn" />
      <HudControlButton type="zoomOut" />
    </div>

    <USeparator class="w-full opacity-60" size="xs" />

    <!-- Sección Inferior: Acciones -->
    <div class="flex flex-col gap-2">
      <HudControlButton type="toggle3D" />
      <HudControlButton type="fitRoute" />
    </div>
  </HudPill>
</template>
