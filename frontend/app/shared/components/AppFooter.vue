<script setup lang="ts">
interface Props {
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  class: "",
});
</script>

<template>
  <footer
    :class="[
      'lg:hidden w-full border-t border-border-subtle/50 bg-surface-base/60 backdrop-blur-md py-4 px-4 sm:px-6 mt-auto z-10',
      props.class,
    ]"
  >
    <div
      class="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted"
    >
      <div class="flex items-center gap-2">
        <span class="font-mono font-semibold text-text-main">FlyWise</span>
        <span class="text-text-dim">•</span>
        <span class="text-text-muted text-[11px] sm:text-xs">
          Inteligencia Aeronáutica y Red Global OTP-15
        </span>
      </div>

      <div class="flex items-center gap-3">
        <ULink
          to="https://github.com/delforrr/FlyWise"
          target="_blank"
          class="inline-flex items-center gap-1.5 font-medium text-text-main hover:text-primary transition-colors py-1 px-2.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-border-subtle shadow-2xs"
          aria-label="Repositorio de FlyWise en GitHub"
        >
          <UIcon name="i-lucide-github" class="size-4 shrink-0" />
          <span>delforrr/FlyWise</span>
          <UIcon name="i-lucide-external-link" class="size-3 opacity-60" />
        </ULink>
      </div>
    </div>
  </footer>
</template>
