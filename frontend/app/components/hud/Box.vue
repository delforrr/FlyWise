<script setup lang="ts">
import type { HudContainerVariant, HudRounded } from "~/types/hud";

export type { HudContainerVariant, HudRounded };

interface Props {
  /**
   * Variante visual del contenedor HUD:
   * @default 'box'
   */
  variant?: HudContainerVariant;

  /**
   * Radio de borde opcional ('none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full' o medida CSS).
   * Por defecto: 'xl' (0.75rem).
   */
  rounded?: HudRounded;

  /**
   * Habilita los efectos interactivos de hover y glow.
   * Por defecto: false para box.
   */
  interactive?: boolean;

  /**
   * Etiqueta HTML.
   * @default 'div'
   */
  as?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "box",
  rounded: undefined,
  interactive: undefined,
  as: "div",
});
</script>

<template>
  <HudContainer
    :variant="props.variant"
    :rounded="props.rounded"
    :interactive="props.interactive"
    :as="props.as"
  >
    <slot />
  </HudContainer>
</template>
