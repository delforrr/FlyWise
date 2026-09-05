<script setup lang="ts">
import { computed } from "vue";
import { useFlightMap } from "~/composables/useFlightMap";

export type actionType =
  | "zoomIn"
  | "zoomOut"
  | "toggle3D"
  | "fitRoute"
  | "resetNorth";

interface Props {
  /**
   * Tipo de control de zoom:
   * - 'zoomIn': Acercar mapa (+).
   * - 'zoomOut': Alejar mapa (-).
   * - 'toggle3D': ALternar vista
   * - 'fitRoute': Encuadrar mapa con los limites seleccionados
   * @default 'zoomIn'
   */
  type?: actionType;

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

const { zoomIn, zoomOut, toggle3D, fitRoute, resetNorth } = useFlightMap();

const mapAction = computed<() => void>(() => {
  if (props.action) {
    return props.action;
  }
  switch (props.type) {
    case "fitRoute":
      return () => fitRoute();
    case "resetNorth":
      return resetNorth;
    case "toggle3D":
      return toggle3D;
    case "zoomOut":
      return zoomOut;
    case "zoomIn":
    default:
      return zoomIn;
  }
});

const computedIcon = computed(() => {
  if (props.icon) return props.icon;

  switch (props.type) {
    case "fitRoute":
      return "i-lucide-maximize";
    case "resetNorth":
      return "i-lucide-locate";
    case "toggle3D":
      return "i-lucide-box";
    case "zoomOut":
      return "i-lucide-zoom-out";
    case "zoomIn":
    default:
      return "i-lucide-zoom-in";
  }
});

const computedAriaLabel = computed(() => {
  if (props.ariaLabel) return props.ariaLabel;

  switch (props.type) {
    case "fitRoute":
      return "Encuadrar ruta seleccionada";
    case "resetNorth":
      return "Restablecer orientación al norte";
    case "toggle3D":
      return "Alternar perspectiva 2D/3D";
    case "zoomOut":
      return "Alejar mapa";
    case "zoomIn":
    default:
      return "Acercar mapa";
  }
});

function handleClick(event: MouseEvent) {
  emit("click", event);
  mapAction.value();
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
    class="text-text-main hover:text-aero-cyan transition-colors"
    @click="handleClick"
  />
</template>
