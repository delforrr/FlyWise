<script setup lang="ts">
import { computed } from "vue";

export type HudContainerVariant = "pill" | "box" | "container";
export type HudRounded =
  | "none"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "full"
  | string;

interface Props {
  /**
   * Variante visual del contenedor HUD:
   * - 'pill': Forma de cápsula horizontal (para barras de búsqueda, selectores).
   * - 'box' | 'container': Contenedor general para tarjetas, menús y desplegables.
   * @default 'container'
   */
  variant?: HudContainerVariant;

  /**
   * Radio de borde opcional (ej: 'none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full' o valor CSS como '12px').
   * Si no se especifica:
   * - 'pill' usa por defecto '3xl' (1.5rem).
   * - 'box' / 'container' usa por defecto 'xl' (0.75rem).
   */
  rounded?: HudRounded;

  /**
   * Habilita los efectos interactivos de hover, focus-within y resplandor HUD.
   * Por defecto: true para 'pill', false para 'box' / 'container'.
   */
  interactive?: boolean;

  /**
   * Etiqueta HTML a renderizar.
   * @default 'div'
   */
  as?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "container",
  rounded: undefined,
  interactive: undefined,
  as: "div",
});

const ROUNDED_TOKENS: Record<string, { class: string; value: string }> = {
  none: { class: "rounded-none", value: "0px" },
  xs: { class: "rounded-xs", value: "0.125rem" },
  sm: { class: "rounded-sm", value: "0.25rem" },
  md: { class: "rounded-md", value: "0.375rem" },
  lg: { class: "rounded-lg", value: "0.5rem" },
  xl: { class: "rounded-xl", value: "0.75rem" },
  "2xl": { class: "rounded-2xl", value: "1rem" },
  "3xl": { class: "rounded-3xl", value: "1.5rem" },
  full: { class: "rounded-full", value: "9999px" },
};

const roundedInfo = computed(() => {
  if (props.rounded !== undefined) {
    const raw = String(props.rounded).trim();
    const token = raw.startsWith("rounded-") ? raw.replace(/^rounded-/, "") : raw;
    if (token in ROUNDED_TOKENS) {
      return ROUNDED_TOKENS[token];
    }
    return { class: "", value: raw };
  }

  // Valores por defecto según la variante
  if (props.variant === "pill") {
    return ROUNDED_TOKENS["3xl"];
  }
  return ROUNDED_TOKENS["xl"];
});

const variantClass = computed(() => {
  switch (props.variant) {
    case "pill":
      return "hud-pill";
    case "box":
      return "hud-box";
    case "container":
    default:
      return "hud-container";
  }
});

const isInteractive = computed(() => {
  if (props.interactive !== undefined) {
    return props.interactive;
  }
  return props.variant === "pill";
});

const containerStyle = computed(() => {
  if (roundedInfo.value.value) {
    return {
      "--hud-border-radius": roundedInfo.value.value,
      borderRadius: roundedInfo.value.value,
    };
  }
  return {};
});
</script>

<template>
  <component
    :is="as"
    :class="[
      variantClass,
      roundedInfo.class,
      { 'is-interactive': isInteractive },
    ]"
    :style="containerStyle"
  >
    <slot />
  </component>
</template>
