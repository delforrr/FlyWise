<script setup lang="ts">
import {
  type DateValue,
  today,
  getLocalTimeZone,
} from "@internationalized/date";

const items = ref([
  "EZE",
  "AFA",
  "COR",
  "MAD",
  "MIA",
  "SCL",
  "GRU",
  "LIM",
  "BCN",
]);
const origin = ref("EZE");
const destination = ref("MAD");
const defaultDate = shallowRef<DateValue>(today(getLocalTimeZone()));
const inputDate = useTemplateRef("inputDate");
const rotation = ref(0);

function swapAirports() {
  const temp = origin.value;
  origin.value = destination.value;
  destination.value = temp;
  rotation.value += 180;
}
import HudPill from "~/components/hud/containers/HudPill.vue";
</script>

<template>
  <HudPill>
    <!-- Selector Origen -->
    <div class="relative flex items-center">
      <UInputMenu
        arrow
        v-model="origin"
        variant="soft"
        :items="items"
        placeholder="Origen"
        icon="i-lucide-plane-takeoff"
        size="sm"
        class="hud-custom-input w-36 font-mono font-semibold"
      />
    </div>

    <!-- Botón Intercambiar Origen / Destino -->
    <UButton
      icon="i-lucide-arrow-left-right"
      variant="ghost"
      size="xs"
      class="rounded-full shrink-0 text-aero-cyan/80 hover:text-aero-cyan hover:bg-surface-card transition-transform"
      :style="{ transform: `rotate(${rotation}deg)` }"
      aria-label="Invertir origen y destino"
      @click="swapAirports"
    />

    <!-- Selector Destino -->
    <div class="relative flex items-center">
      <UInputMenu
        arrow
        v-model="destination"
        :items="items"
        variant="soft"
        placeholder="Destino"
        icon="i-lucide-plane-landing"
        size="sm"
        class="hud-custom-input w-36 font-mono font-semibold"
      />
    </div>

    <USeparator orientation="vertical" class="h-4" size="sm" />

    <!-- Input de Fecha-->
    <div>
      <UInputDate
        ref="inputDate"
        v-model="defaultDate"
        size="sm"
        variant="ghost"
      >
        <template #leading>
          <UPopover arrow :reference="inputDate?.inputsRef[3]?.$el">
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              icon="i-lucide-calendar"
              aria-label="Select a date"
              class="w-10"
            />

            <template #content>
              <UCalendar v-model="defaultDate" class="p-2" />
            </template>
          </UPopover>
        </template>
      </UInputDate>
    </div>

    <!-- Botón de Búsqueda HUD -->
    <UButton
      icon="i-lucide-search"
      size="sm"
      class="btn-hud-primary rounded-xl shrink-0 px-2.5 sm:px-3 shadow-md"
      aria-label="Buscar vuelo"
    />
  </HudPill>
</template>
