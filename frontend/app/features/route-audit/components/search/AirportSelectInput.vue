<script setup lang="ts">
import { computed } from "vue";
import { SEED_AIRPORTS } from "~/data/seedData";

export interface AirportOption {
  id: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  label: string;
  description: string;
  value: string;
}

export interface AirportSelectInputProps {
  /**
   * Modo visual y de densidad del selector:
   * - 'hud': Compacto para la barra de navegación / HudPill (muestra solo el código IATA al seleccionar).
   * - 'hero': Estilo transparente sin bordes para embeber dentro de InputCard en la landing.
   * - 'drawer': Estilo táctil amplio para modales y drawer móvil.
   * @default 'hud'
   */
  mode?: "hud" | "hero" | "drawer";

  /**
   * Texto de marcador de posición (placeholder).
   */
  placeholder?: string;

  /**
   * Ícono representativo en el extremo inicial (ej. 'i-lucide-plane-takeoff').
   */
  icon?: string;

  /**
   * Tamaño del input (de Nuxt UI: 'xs' | 'sm' | 'md' | 'lg' | 'xl').
   * Si no se define, se infiere del modo.
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Mostrar flecha indicadora de dropdown.
   */
  arrow?: boolean;

  /**
   * Mostrar botón para limpiar selección (clear).
   */
  clear?: boolean;

  /**
   * Clases complementarias para el contenedor del input.
   */
  class?: string;

  /**
   * Configuración de estilos UI de Nuxt UI.
   */
  ui?: Record<string, any>;
}

const props = withDefaults(defineProps<AirportSelectInputProps>(), {
  mode: "hud",
  placeholder: undefined,
  icon: undefined,
  size: undefined,
  arrow: undefined,
  clear: undefined,
  class: undefined,
  ui: undefined,
});

const modelValue = defineModel<string | undefined>({
  default: undefined,
});

const airportItems = computed<AirportOption[]>(() => {
  return SEED_AIRPORTS.map((a) => {
    let label = a.iata;
    if (props.mode === "hero") {
      label = `${a.name} [${a.iata}]`;
    } else if (props.mode === "drawer") {
      label = `${a.iata} — ${a.city}`;
    }

    return {
      id: a.id,
      iata: a.iata,
      name: a.name,
      city: a.city,
      country: a.country,
      label,
      description: `${a.country}, ${a.city}`,
      value: a.iata,
    };
  });
});

const resolvedSize = computed(() => {
  if (props.size) return props.size;
  if (props.mode === "hero") return "xl";
  if (props.mode === "drawer") return "lg";
  return "sm";
});

const resolvedVariant = computed(() => {
  if (props.mode === "hero") return "ghost";
  return "soft";
});

const resolvedArrow = computed(() => {
  if (props.arrow !== undefined) return props.arrow;
  return props.mode !== "hero";
});

const resolvedClear = computed(() => {
  if (props.clear !== undefined) return props.clear;
  return props.mode === "hero";
});

const resolvedTrailingIcon = computed(() => {
  if (props.mode === "hero") return false;
  return undefined;
});

const resolvedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  if (props.mode === "hero") return "Aeropuerto, IATA o Ciudad";
  if (props.mode === "drawer") return "Seleccionar aeropuerto";
  return "Aeropuerto";
});

const resolvedClass = computed(() => {
  const classes: string[] = [];
  if (props.mode === "hero") {
    classes.push("w-full flex-1 input-ghost");
  } else if (props.mode === "drawer") {
    classes.push("hud-custom-input w-full font-mono font-semibold");
  } else {
    classes.push(
      "hud-custom-input w-22 sm:w-28 md:w-36 shrink-0 font-mono font-semibold text-xs sm:text-sm",
    );
  }

  if (props.class) {
    classes.push(props.class);
  }

  return classes.join(" ");
});

const resolvedUi = computed(() => {
  if (props.ui) return props.ui;
  if (props.mode === "hero") {
    return {
      base: "bg-transparent! hover:bg-transparent! focus:bg-transparent! active:bg-transparent! border-0! ring-0! shadow-none! focus-visible:ring-0! text-text-main font-semibold text-sm sm:text-base ps-1 sm:ps-2.5 pe-9 sm:pe-10 truncate",
      trailing: "pe-2 sm:pe-3",
      trailingClear:
        "text-text-muted hover:text-text-main transition-colors cursor-pointer",
    };
  }
  return undefined;
});
</script>

<template>
  <UInputMenu
    v-model="modelValue"
    :items="airportItems"
    value-key="value"
    label-key="label"
    :filter-fields="['iata', 'name', 'city', 'country']"
    :placeholder="resolvedPlaceholder"
    :icon="icon"
    :size="resolvedSize"
    :variant="resolvedVariant"
    :arrow="resolvedArrow"
    :clear="resolvedClear"
    :trailing-icon="resolvedTrailingIcon"
    :class="resolvedClass"
    :ui="resolvedUi"
  >
    <template #item-label="{ item }">
      <span class="truncate text-xs sm:text-sm font-medium text-text-main">
        {{ item.name }}
        <span class="font-mono font-bold text-primary">[{{ item.iata }}]</span>
      </span>
    </template>
    <template #item-description="{ item }">
      <span class="text-[11px] sm:text-xs text-text-muted truncate">
        {{ item.country }}, {{ item.city }}
      </span>
    </template>
  </UInputMenu>
</template>