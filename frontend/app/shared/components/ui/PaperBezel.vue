<script setup lang="ts">
interface Props {
  as?: string;
  class?: string;
  coreClass?: string;
  transitionName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  class: "",
  coreClass: "",
  transitionName: "hero-bezel-card",
});
</script>

<template>
  <UCard
    :as="props.as"
    :class="['double-bezel-shell w-full shadow-2xl p-0 ring-0', props.class]"
    :ui="{
      root: 'p-0 ring-0 divide-y-0',
      body: ['double-bezel-core flex flex-col p-0', props.coreClass],
    }"
    :style="props.transitionName ? { viewTransitionName: props.transitionName } : undefined"
  >
    <slot />
  </UCard>
</template>
