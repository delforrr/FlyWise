<template>
  <!-- Cápsula vertical de 14rem (w-56) con secciones separadas -->
  <HudPill vertical width="w-56" interactive class="p-2 gap-2">
    <!-- Sección Superior: Controles de Zoom -->
    <HudControlButton type="zoomIn" />
    <HudControlButton type="zoomOut" />

    <USeparator class="w-full opacity-60" size="xs" />

    <!-- Sección Inferior: Filtros o Acciones -->
    <div class="flex items-center justify-center w-full py-1">
      <UButton
        icon="i-lucide-layers"
        label="Capas"
        variant="ghost"
        size="xs"
        block
      />
    </div>
  </HudPill>
</template>
