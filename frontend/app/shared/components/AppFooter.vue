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
      'lg:hidden w-full border-t border-border-subtle bg-surface-elevated/90 dark:bg-surface-base/80 backdrop-blur-xl py-3.5 px-4 sm:px-6 mt-auto z-10 shadow-sm',
      props.class,
    ]"
  >
    <div
      class="w-full flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-text-muted"
    >
      <div class="flex items-center gap-2">
        <span class="font-mono font-bold text-text-main">FlyWise</span>
        <span class="text-text-dim">•</span>
        <span class="text-text-muted text-[11px] sm:text-xs">
          Inteligencia Aeronáutica & OTP-15
        </span>
      </div>

      <div class="flex items-center gap-3">
        <ULink
          to="https://github.com/delforrr/FlyWise"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 font-semibold text-xs text-text-main hover:text-primary transition-colors py-1 px-2.5 rounded-lg bg-surface-card hover:bg-surface-accent border border-border-subtle shadow-2xs active:scale-[0.98]"
          aria-label="Repositorio de FlyWise en GitHub"
        >
          <UIcon name="i-lucide-github" class="size-3.5 shrink-0 text-text-main" />
          <span>delforrr/FlyWise</span>
          <UIcon name="i-lucide-external-link" class="size-3 text-text-dim" />
        </ULink>
      </div>
    </div>
  </footer>
</template>
