<script setup lang="ts">
import { computed } from "vue";

export type HudOrientation = "horizontal" | "vertical";

interface Props {
  /**
   * Variante visual del contenedor HUD:
   * - 'pill': Cápsula interactiva horizontal o vertical.
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
   * Orientación del contenedor cápsula:
   * - 'horizontal': Disposición horizontal (flex-row).
   * - 'vertical': Disposición vertical (flex-col).
   * @default 'horizontal'
   */
  orientation?: HudOrientation;

  /**
   * Atajo booleano para orientación vertical (`<HudPill vertical />`).
   * @default false
   */
  vertical?: boolean;

  /**
   * Define si el contenedor utiliza display flex para su contenido.
   * Si se define en false, pasa a display block tradicional.
   * @default true
   */
  flex?: boolean;

  /**
   * Alineación de los elementos en el eje secundario (align-items).
   * Ej: 'start', 'center', 'end', 'stretch', 'baseline'.
   */
  align?: "start" | "center" | "end" | "stretch" | "baseline";

  /**
   * Distribución de los elementos en el eje principal (justify-content).
   * Ej: 'start', 'center', 'end', 'between', 'around', 'evenly'.
   */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";

  /**
   * Espacio entre elementos hijos (gap). Admite medida CSS o número en px.
   */
  gap?: string | number;

  /**
   * Ancho explícito del contenedor cápsula.
   * Admite:
   * - Clases de Tailwind (ej: 'w-48', 'w-full', 'w-fit')
   * - Medidas CSS (ej: '200px', '14rem', '100%')
   * - Números en px (ej: 220)
   * - Palabras clave ('full', 'fit', 'auto')
   */
  width?: string | number;

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
  orientation: "horizontal",
  vertical: false,
  flex: true,
  align: undefined,
  justify: undefined,
  gap: undefined,
  width: undefined,
  as: "div",
});

const isVertical = computed(
  () => props.vertical || props.orientation === "vertical",
);

const ALIGN_MAP: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const JUSTIFY_MAP: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

const pillClasses = computed(() => {
  const classes: (string | undefined)[] = [];

  if (!props.flex) {
    classes.push("is-not-flex", "!block");
  } else {
    classes.push(isVertical.value ? "is-vertical flex-col" : "flex-row");
    if (props.align) classes.push(ALIGN_MAP[props.align]);
    if (props.justify) classes.push(JUSTIFY_MAP[props.justify]);
  }

  if (
    typeof props.width === "string" &&
    (props.width.startsWith("w-") || props.width.startsWith("!w-"))
  ) {
    classes.push(props.width);
  }

  return classes.filter(Boolean);
});

const pillStyles = computed(() => {
  const styles: Record<string, string> = {};

  if (props.gap !== undefined) {
    styles.gap = typeof props.gap === "number" ? `${props.gap}px` : props.gap;
  }

  if (props.width !== undefined) {
    let resolved = "";
    if (typeof props.width === "number") {
      resolved = `${props.width}px`;
    } else if (props.width === "full") {
      resolved = "100%";
    } else if (props.width === "fit") {
      resolved = "fit-content";
    } else if (props.width === "auto") {
      resolved = "auto";
    } else if (
      !props.width.startsWith("w-") &&
      !props.width.startsWith("!w-")
    ) {
      resolved = props.width;
    }

    if (resolved) {
      styles.width = resolved;
      styles["--hud-pill-width"] = resolved;
    }
  }

  return styles;
});
</script>

<template>
  <HudContainer
    :variant="props.variant"
    :rounded="props.rounded"
    :interactive="props.interactive"
    :as="props.as"
    :class="pillClasses"
    :style="pillStyles"
  >
    <slot></slot>
  </HudContainer>
</template>
