<script setup lang="ts">
import { computed } from "vue";
import { useFlightMap } from "~/composables/useFlightMap";

export type ZoomType = "zoomIn" | "zoomOut";

interface Props {
  /**
   * Tipo de control de zoom:
   * - 'zoomIn': Acercar mapa (+).
   * - 'zoomOut': Alejar mapa (-).
   * @default 'zoomIn'
   */
  type?: ZoomType;

  /**
   * Callback personalizado opcional a ejecutar al hacer clic.
   * Si no se proporciona, invoca automáticamente zoomIn() o zoomOut() de useFlightMap().
   */
  action?: () => void;

  /**
   * Ícono opcional para sobrescribir el predeterminado.
   */
  icon?: string;

  /**
   * Texto de accesibilidad (aria-label).
   */
  ariaLabel?: string;

  /**
   * Deshabilita el botón de control.
   * @default false
   */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: "zoomIn",
  action: undefined,
  icon: undefined,
  ariaLabel: undefined,
  disabled: false,
});

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const { zoomIn, zoomOut } = useFlightMap();

const zoomAction = computed<() => void>(() => {
  if (props.action) {
    return props.action;
  }
  return props.type === "zoomIn" ? zoomIn : zoomOut;
});

const computedIcon = computed(() => {
  if (props.icon) return props.icon;
  return props.type === "zoomIn" ? "i-lucide-plus" : "i-lucide-minus";
});

const computedAriaLabel = computed(() => {
  if (props.ariaLabel) return props.ariaLabel;
  return props.type === "zoomIn" ? "Acercar mapa" : "Alejar mapa";
});

function handleClick(event: MouseEvent) {
  emit("click", event);
  zoomAction.value();
}
</script>

<template>
    <UButton
      :icon="computedIcon"
      color="neutral"
      variant="ghost"
      size="sm"
      :disabled="props.disabled"
      :aria-label="computedAriaLabel"
      class="text-color-text-main hover:text-aero-cyan transition-colors"
      @click="handleClick"
    />
</template>
