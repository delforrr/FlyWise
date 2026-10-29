<script setup lang="ts">
interface Props {
  hasControls?: boolean;
  hasLogin?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hasControls: false,
  navs: () => [],
  hasLogin: false,
});

const isPaletteOpen = useState("cockpit_command_palette_open", () => false);
const { isOpen: isGlobalFilterOpen } = useGlobalMap();
</script>

<template>
  <UHeader
    title="FlyWise"
    :toggle="false"
    :ui="{
      root: 'mt-2 sm:mt-4 sticky top-2 sm:top-4 z-50 mx-3 sm:mx-6 rounded-2xl bg-surface-card/95 dark:bg-surface-base/85 backdrop-blur-2xl border border-border-subtle shadow-[0_10px_25px_-5px_rgba(11,28,48,0.08),0_4px_6px_-2px_rgba(11,28,48,0.03)] dark:shadow-2xl transition-all duration-400 h-auto',
      container:
        'w-full max-w-none px-3.5 sm:px-6 py-2 sm:py-2.5 flex flex-wrap md:flex-nowrap items-center justify-between gap-3',
      left: 'flex-none flex items-center gap-3',
      center:
        'hidden md:flex flex-1 items-center justify-center px-2 sm:px-4 min-w-0',
      right: 'flex-none flex items-center justify-end gap-2 sm:gap-3',
    }"
  >
    <!-- Logo & Título de Precisión Aeronáutica -->
    <template #title>
      <NuxtLink to="/" class="flex flex-col cursor-pointer group">
        <span class="flex flex-row items-center gap-2 sm:gap-2.5">
          <span
            class="font-display font-bold text-xl sm:text-2xl text-text-main tracking-tight group-hover:text-primary transition-colors"
          >
            FlyWise
          </span>
        </span>
        <p
          class="text-[11px] font-mono text-text-muted hidden sm:block tracking-tight"
        >
          Volá con Confianza
        </p>
      </NuxtLink>
    </template>

    <!-- Navs de la página principal -->
    <template #default>
      <FromToDate
        v-if="hasControls"
        class="hidden md:flex w-full justify-center"
      />
    </template>

    <!-- Botón de login y controles -->
    <template #right>
      <UButton v-if="hasControls" icon="i-lucide-list-filter" color="neutral" variant="ghost" class="shrink-0 whitespace-nowrap"
        aria-label="Filtrar mapa" title="Filtrar mapa" @click="isGlobalFilterOpen = true">
        <span class="hidden lg:inline">Filtrar mapa</span>
      </UButton>
      <UButton
        icon="i-lucide-command"
        variant="ghost"
        color="neutral"
        class="hidden md:flex rounded-xl font-mono text-xs text-text-muted hover:text-text-main hover:bg-surface-accent border border-border-subtle/70 transition-all shrink-0 px-2 sm:px-2.5"
        aria-label="Abrir paleta de comandos"
        title="Buscar comandos (⌘K)"
        @click="isPaletteOpen = true"
      >
        <span class="hidden 2xl:inline font-mono">Buscar...</span>
        <span class="hidden lg:inline-flex items-center gap-0.5">
          <UKbd value="meta" />
          <UKbd value="k" />
        </span>
      </UButton>
      <ThemeToggle />
      <UButton
        v-if="hasLogin"
        icon="i-lucide-user"
        size="md"
        variant="ghost"
        to="/login"
        class="rounded-xl font-semibold text-xs sm:text-sm text-text-main hover:text-primary hover:bg-surface-accent border border-border-subtle dark:border-border-subtle/60 transition-all active:scale-[0.98]"
        aria-label="Acceso administrativo"
        label="Acceso Admin"
        :ui="{ label: 'hidden xl:inline' }"
      />
    </template>
  </UHeader>

  <CommandPalette />
</template>
