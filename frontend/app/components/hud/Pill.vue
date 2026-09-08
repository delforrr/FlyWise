<script setup lang="ts">
import { computed } from "vue";
import type { HudContainerVariant, HudRounded, HudOrientation } from "~/types/hud";

export type { HudContainerVariant, HudRounded, HudOrientation };

interface Props {
  variant?: HudContainerVariant;
  rounded?: HudRounded;
  interactive?: boolean;
  orientation?: HudOrientation;
  vertical?: boolean;
  as?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "pill",
  rounded: undefined,
  interactive: true,
  orientation: "horizontal",
  vertical: false,
  as: "div",
});

const isVertical = computed(
  () => props.vertical || props.orientation === "vertical",
);
</script>

<template>
  <HudContainer
    :variant="props.variant"
    :rounded="props.rounded"
    :interactive="props.interactive"
    :as="props.as"
    class="flex items-center"
    :class="[isVertical ? 'flex-col is-vertical' : 'flex-row']"
  >
    <slot />
  </HudContainer>
</template>
