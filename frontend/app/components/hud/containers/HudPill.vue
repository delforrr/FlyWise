<script setup lang="ts">
import HudContainer from "./HudContainer.vue";
import type {
  HudContainerVariant,
  HudRounded,
} from "./HudContainer.vue";

interface Props {
  /**
   * Variante visual del contenedor HUD:
   * - 'pill': Cápsula interactiva horizontal.
   * - 'box' | 'container': Contenedor general o tarjeta.
   * @default 'pill'
   */
  variant?: HudContainerVariant;

  /**
   * Radio de borde opcional ('none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full' o medida CSS).
   */
  rounded?: HudRounded;

  /**
   * Habilita los efectos interactivos de hover y glow.
   */
  interactive?: boolean;

  /**
   * Etiqueta HTML.
   * @default 'div'
   */
  as?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "pill",
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
