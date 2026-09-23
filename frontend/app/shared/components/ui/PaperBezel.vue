<script setup lang="ts">
interface Props {
  as?: string;
  class?: string;
  coreClass?: string;
  transitionName?: string;
}

withDefaults(defineProps<Props>(), {
  as: "div",
  class: "",
  coreClass: "",
  transitionName: "hero-bezel-card",
});
</script>

<template>
  <component
    :is="as"
    class="double-bezel-shell w-full shadow-2xl"
    :class="class"
    :style="transitionName ? { viewTransitionName: transitionName } : undefined"
  >
    <div class="double-bezel-core flex flex-col" :class="coreClass">
      <slot />
    </div>
  </component>
</template>
