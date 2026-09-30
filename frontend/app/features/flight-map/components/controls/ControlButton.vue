<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";

export type actionType =
  | "zoomIn"
  | "zoomOut"
  | "toggle3D"
  | "fitRoute"
  | "resetNorth"
  | "shortcuts";

interface Props {
  /**
   * Tipo de control de cabina HUD:
   * - 'zoomIn': Acercar mapa (+).
   * - 'zoomOut': Alejar mapa (-).
   * - 'toggle3D': Alternar perspectiva 2D cenital y 3D isométrica.
   * - 'fitRoute': Encuadrar mapa con la ruta o hub seleccionado.
   * - 'resetNorth': Restablecer rumbo al norte magnético (0°).
   * - 'shortcuts': Abrir manual operativo de atajos de cabina (?).
   * @default 'zoomIn'
   */
  type?: actionType;

  /**
   * Callback personalizado opcional a ejecutar al hacer clic.
   * Si no se proporciona, invoca automáticamente la acción correspondiente de useFlightMap().
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

const {
  zoomIn,
  zoomOut,
  toggle3D,
  fitRoute,
  resetNorth,
  currentPitch,
  mapInstance,
} = useFlightMap();

// Estado dinámico del rumbo / bearing del mapa para el indicador de brújula
const currentBearing = ref<number>(0);

function handleRotate() {
  if (mapInstance.value) {
    currentBearing.value = Math.round(mapInstance.value.getBearing() * 10) / 10;
  }
}

watch(
  mapInstance,
  (newMap, oldMap) => {
    if (oldMap) {
      oldMap.off("rotate", handleRotate);
    }
    if (newMap) {
      handleRotate();
      newMap.on("rotate", handleRotate);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.off("rotate", handleRotate);
  }
});

// Estado de 3D activo cuando el pitch supera el umbral cenital (> 5 grados)
const is3DActive = computed(() => {
  return props.type === "toggle3D" && currentPitch.value > 5;
});

// Desviación del norte cuando el bearing es perceptible (> 1 grado)
const isOffNorth = computed(() => {
  return props.type === "resetNorth" && Math.abs(currentBearing.value) > 1;
});

const mapAction = computed<() => void>(() => {
  if (props.action) {
    return props.action;
  }
  switch (props.type) {
    case "shortcuts":
      return () => {
        useState("cockpit_shortcuts_modal", () => false).value = true;
      };
    case "fitRoute":
      return fitRoute;
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
    case "shortcuts":
      return "i-lucide-keyboard";
    case "fitRoute":
      return "i-lucide-maximize";
    case "resetNorth":
      return "i-lucide-compass";
    case "toggle3D":
      return is3DActive.value ? "i-lucide-box" : "i-lucide-layers";
    case "zoomOut":
      return "i-lucide-minus";
    case "zoomIn":
    default:
      return "i-lucide-plus";
  }
});

const computedAriaLabel = computed(() => {
  if (props.ariaLabel) return props.ariaLabel;

  switch (props.type) {
    case "shortcuts":
      return "Manual de atajos de teclado (?)";
    case "fitRoute":
      return "Encuadrar ruta seleccionada";
    case "resetNorth":
      return isOffNorth.value
        ? `Restablecer orientación al norte (${Math.round((currentBearing.value + 360) % 360)}°)`
        : "Orientación al norte (0°)";
    case "toggle3D":
      return is3DActive.value
        ? "Desactivar perspectiva 3D (volver a vista cenital 2D)"
        : "Activar perspectiva 3D";
    case "zoomOut":
      return "Alejar mapa (-)";
    case "zoomIn":
    default:
      return "Acercar mapa (+)";
  }
});

function handleClick(event: MouseEvent) {
  emit("click", event);
  mapAction.value();
}
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    :disabled="props.disabled"
    :aria-label="computedAriaLabel"
    :title="computedAriaLabel"
    class="relative flex items-center justify-center w-10 h-10 min-w-10 min-h-10 p-0 rounded-xl border border-border-subtle/80 border-t-white/35 dark:border-t-white/15 bg-surface-card/75 dark:bg-surface-base/75 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:text-primary hover:bg-surface-accent/80 hover:border-primary/40 hover:shadow-[0_0_14px_rgba(56,189,248,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-95 transition-all duration-200 select-none cursor-pointer"
    :class="[
      is3DActive
        ? 'text-primary! bg-primary/15! border-primary/50! shadow-[0_0_12px_rgba(56,189,248,0.3),inset_0_1px_0_rgba(56,189,248,0.4)]!'
        : 'text-text-main',
    ]"
    @click="handleClick"
  >
    <!-- Slot personalizado o contenido por defecto según acción -->
    <slot>
      <!-- Indicador Aeronáutico de Brújula con Aguja Giratoria Dinámica para resetNorth -->
      <template v-if="props.type === 'resetNorth' && !props.icon">
        <div
          class="relative flex items-center justify-center w-5 h-5 pointer-events-none transition-transform duration-200 ease-out"
          :style="{ transform: `rotate(${-currentBearing}deg)` }"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            class="w-5 h-5 drop-shadow-xs"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Aguja Norte (Rojo aeronáutico / acento de navegación) -->
            <polygon
              points="12,2.5 15.5,12 12,10 8.5,12"
              class="fill-rose-500 dark:fill-rose-400"
            />
            <!-- Aguja Sur (Tono neutro tenue) -->
            <polygon
              points="12,21.5 15.5,12 12,10 8.5,12"
              class="fill-text-muted/60 dark:fill-text-muted/40"
            />
            <!-- Eje central -->
            <circle
              cx="12"
              cy="11"
              r="1.6"
              class="fill-surface-card dark:fill-surface-base stroke-border-subtle stroke-[1.2]"
            />
          </svg>
        </div>
      </template>

      <!-- Ícono estándar para el resto de controles o cuando se pasa icon personalizado -->
      <UIcon
        v-else
        :name="computedIcon"
        class="w-5 h-5 transition-transform duration-200"
        :style="
          props.type === 'resetNorth'
            ? { transform: `rotate(${-currentBearing}deg)` }
            : undefined
        "
      />
    </slot>

    <!-- Badge Activo 3D / 2D con Resplandor Aeronáutico -->
    <span
      v-if="props.type === 'toggle3D'"
      class="absolute -top-1 -right-1 px-1 py-0.2 text-[8px] font-mono font-bold leading-tight uppercase rounded tracking-wider pointer-events-none select-none transition-all duration-200"
      :class="[
        is3DActive
          ? 'bg-primary text-slate-950 shadow-[0_0_8px_rgba(56,189,248,0.55)] font-black'
          : 'bg-surface-elevated/90 text-text-muted border border-border-subtle/80',
      ]"
      aria-hidden="true"
    >
      {{ is3DActive ? '3D' : '2D' }}
    </span>
  </UButton>
</template>
