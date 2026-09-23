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
    let label = `${a.iata} — ${a.city}`;
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
  return "Aeropuerto o Ciudad";
});

const resolvedClass = computed(() => {
  const classes: string[] = [];
  if (props.mode === "hero") {
    classes.push("w-full flex-1 input-ghost");
  } else if (props.mode === "drawer") {
    classes.push("hud-custom-input w-full font-mono font-semibold");
  } else {
    classes.push(
      "hud-custom-input flex-1 min-w-0 font-mono font-semibold text-xs sm:text-sm",
    );
  }

  if (props.class) {
    classes.push(props.class);
  }

  return classes.join(" ");
});

const resolvedUi = computed(() => {
  const baseUi = props.ui || {};

  const commonContent =
    "w-max min-w-(--reka-combobox-trigger-width) max-w-[min(90vw,36rem)] shadow-2xl backdrop-blur-xl border border-border-subtle z-50";

  if (props.mode === "hero") {
    return {
      base: "bg-transparent! hover:bg-transparent! focus:bg-transparent! active:bg-transparent! border-0! ring-0! shadow-none! focus-visible:ring-0! text-text-main font-semibold text-sm sm:text-base ps-1 sm:ps-2.5 pe-9 sm:pe-10 truncate",
      trailing: "pe-2 sm:pe-3",
      trailingClear:
        "text-text-muted hover:text-text-main transition-colors cursor-pointer",
      content: commonContent,
      itemLabel: "w-full min-w-0",
      ...baseUi,
    };
  }

  if (props.mode === "hud") {
    return {
      base: "truncate font-mono font-semibold text-xs sm:text-sm",
      content: commonContent,
      itemLabel: "w-full min-w-0",
      ...baseUi,
    };
  }

  return {
    content: commonContent,
    itemLabel: "w-full min-w-0",
    ...baseUi,
  };
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
      <div class="flex items-center justify-between gap-3 w-full min-w-0">
        <span class="truncate text-xs sm:text-sm font-medium text-text-main">
          {{ item.name }}
        </span>
        <span
          class="font-mono font-bold text-primary shrink-0 text-[11px] sm:text-xs bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 tracking-wider"
        >
          {{ item.iata }}
        </span>
      </div>
    </template>
    <template #item-description="{ item }">
      <div
        class="flex items-center gap-1.5 text-[11px] sm:text-xs text-text-muted truncate"
      >
        <UIcon name="i-lucide-map-pin" class="size-3 text-text-dim shrink-0" />
        <span class="truncate">{{ item.country }}, {{ item.city }}</span>
      </div>
    </template>
  </UInputMenu>
</template>
