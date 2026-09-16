<script setup lang="ts">
import { computed } from "vue";
import type { InputCardType } from "~/types/hud";

export type { InputCardType };

export interface InputCardAirportInfo {
  name?: string;
  city?: string;
  country?: string;
  iata?: string;
}

interface Props {
  /**
   * Tipo de tarjeta de aeropuerto: 'origin' (Origen) o 'destination' (Destino).
   * @default 'origin'
   */
  type?: InputCardType;

  /**
   * Etiqueta descriptiva visible en el badge superior.
   * Si no se especifica, se asigna automáticamente 'Origen' o 'Destino'.
   */
  label?: string;

  /**
   * Código IATA del aeropuerto seleccionado (ej: 'EZE', 'MAD', 'JFK').
   */
  iata?: string | null;

  /**
   * Información del aeropuerto seleccionado (ciudad, país, etc.) para el subtítulo.
   */
  airport?: InputCardAirportInfo | null;

  /**
   * Ícono representativo para la tarjeta.
   * Por defecto: 'i-lucide-plane-takeoff' (origen) o 'i-lucide-plane-landing' (destino).
   */
  icon?: string;

  /**
   * Clases CSS complementarias a aplicar sobre el contenedor de la tarjeta.
   */
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: "origin",
  label: undefined,
  iata: null,
  airport: null,
  icon: undefined,
  class: "",
});

const isOrigin = computed(() => props.type === "origin");

const resolvedLabel = computed(() => {
  if (props.label) return props.label;
  return isOrigin.value ? "Origen" : "Destino";
});

const resolvedIcon = computed(() => {
  if (props.icon) return props.icon;
  return isOrigin.value ? "i-lucide-plane-takeoff" : "i-lucide-plane-landing";
});

const typeClass = computed(() => {
  return isOrigin.value ? "input-card--origin" : "input-card--destination";
});

const subtitleText = computed(() => {
  if (!props.airport) return "";
  const parts = [props.airport.city, props.airport.country].filter(Boolean);
  return parts.join(", ");
});
</script>

<template>
  <div
    :class="[
      'input-card p-3 sm:p-4 md:p-5 gap-2.5 sm:gap-3',
      typeClass,
      props.class,
    ]"
    :data-type="type"
    role="group"
    :aria-label="`Selector de aeropuerto de ${resolvedLabel.toLowerCase()}`"
  >
    <!-- Cabecera de la tarjeta: Identifica inequívocamente Origen o Destino -->
    <div class="flex items-center justify-between gap-2">
      <div class="input-card-badge">
        <UIcon :name="resolvedIcon" class="size-3.5 shrink-0" />
        <span class="text-[11px] sm:text-xs">{{ resolvedLabel }}</span>
      </div>

      <slot name="header-right" />
    </div>

    <!-- Cuerpo interactivo: Badge IATA + Slot de Input Ghost + Subtítulo -->
    <div class="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
      <!-- Badge IATA si está seleccionado, o ícono placeholder cuando está vacío -->
      <slot name="iata">
        <div
          v-if="iata"
          class="input-iata flex items-center justify-center font-mono font-bold shrink-0 size-11 sm:size-13 md:size-14 text-sm sm:text-base md:text-lg"
        >
          {{ iata }}
        </div>
        <div
          v-else
          class="input-card-placeholder-icon flex items-center justify-center shrink-0 size-11 sm:size-13 md:size-14"
          :title="`Seleccionar aeropuerto de ${resolvedLabel.toLowerCase()}`"
        >
          <UIcon :name="resolvedIcon" class="size-4 sm:size-5 opacity-60" />
        </div>
      </slot>

      <!-- Contenedor del Input principal y detalles -->
      <div class="flex flex-col flex-1 min-w-0">
        <slot />

        <!-- Subtítulo de ubicación (Ciudad, País) -->
        <slot name="subtitle">
          <p
            v-if="subtitleText"
            class="text-[11px] sm:text-xs text-text-muted px-1 sm:px-2.5 pt-0.5 truncate flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="size-3 text-text-dim shrink-0"
            />
            <span class="truncate">{{ subtitleText }}</span>
          </p>
        </slot>
      </div>
    </div>

    <slot name="footer" />
  </div>
</template>
