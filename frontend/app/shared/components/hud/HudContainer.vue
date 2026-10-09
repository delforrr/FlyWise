<script setup lang="ts">
import { computed } from "vue";
import type { HudContainerVariant, HudRounded } from "~/types/hud";

export type { HudContainerVariant, HudRounded };

interface Props {
  /**
   * Variante visual del contenedor HUD:
   * - 'pill': Forma de cápsula horizontal.
   * - 'box' | 'container': Contenedor general para tarjetas, menús y desplegables.
   * @default 'container'
   */
  variant?: HudContainerVariant;

  /**
   * Radio de borde opcional (ej: 'none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full').
   */
  rounded?: HudRounded;

  /**
   * Habilita los efectos interactivos de hover, focus-within y resplandor HUD.
   */
  interactive?: boolean;

  /**
   * Etiqueta HTML a renderizar.
   * @default 'div'
   */
  as?: string;

  /**
   * Clases adicionales opcionales.
   */
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "container",
  rounded: undefined,
  interactive: undefined,
  as: "div",
  class: "",
});

const variantClass = computed(() =>
  props.variant === "pill" ? "hud-pill" : "hud-container"
);

const isInteractive = computed(
  () => props.interactive ?? props.variant === "pill"
);

const roundedClass = computed(() => {
  if (props.rounded) {
    return props.rounded.startsWith("rounded-")
      ? props.rounded
      : `rounded-${props.rounded}`;
  }
  return props.variant === "pill" ? "rounded-3xl" : "rounded-xl";
});
</script>

<template>
  <component
    :is="as"
    :class="[
      variantClass,
      roundedClass,
      { 'is-interactive': isInteractive },
      props.class,
    ]"
  >
    <slot />
  </component>
</template>
