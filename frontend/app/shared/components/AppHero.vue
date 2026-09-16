<script setup lang="ts">
interface FeatureProps {
  title: string;
  description: string;
  icon: string;
  badge?: string;
}

interface Props {
  compact?: boolean;
  showRadar?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showRadar: true,
  class: "",
});

const features: FeatureProps[] = [
  {
    title: "Mapa Interactivo",
    description: "Navegación fluida y controles flexibles con Deck.gl.",
    icon: "i-lucide-map",
  },
  {
    title: "Puntualidad OTP-15",
    description: "Estándar internacional de demoras por tramo y aerolínea.",
    icon: "i-lucide-clock",
  },
  {
    title: "Auditoría de Rutas",
    description: "Desempeño histórico y confiabilidad para vuelos comerciales.",
    icon: "i-lucide-route",
  },
];
</script>

<template>
  <div
    :class="[
      'relative flex flex-col justify-center w-full max-w-5xl px-3 sm:px-6 lg:px-8 py-2 sm:py-4 lg:py-8 overflow-hidden rounded-3xl',
      props.class,
    ]"
  >
    <!-- Fondo ambiental en Móvil / Tablet: Gradiente aero sutil y elegante -->
    <div
      class="lg:hidden absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl"
      aria-hidden="true"
    >
      <div
        class="absolute -top-8 -left-8 w-44 h-44 rounded-full bg-primary/15 blur-2xl"
      />
      <div
        class="absolute -bottom-8 -right-8 w-44 h-44 rounded-full bg-secondary/15 blur-2xl"
      />
      <div
        class="absolute inset-0 bg-radial-[at_center] from-primary/8 via-transparent to-transparent"
      />
    </div>

    <!-- Fondo Radar en Desktop: Animación HUD aeronáutica completa -->
    <RadarBackground
      v-if="showRadar"
      class="hidden lg:flex absolute inset-0 z-0 opacity-40 dark:opacity-60 scale-100 lg:scale-110 pointer-events-none"
    />

    <div class="relative z-10 flex flex-col gap-3 sm:gap-6">
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-semibold tracking-wider uppercase text-primary bg-primary/10 border border-primary/25 shadow-xs"
        >
          <span class="size-1.5 rounded-full bg-primary animate-pulse" />
          Inteligencia Aeronáutica
        </span>
        <span class="hidden sm:inline-block text-xs font-mono text-text-dim">
          OTP-15 Engine v1.0
        </span>
      </div>

      <div class="flex flex-col gap-1 sm:gap-2">
        <h1
          class="text-2xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-text-main leading-tight"
        >
          Información de Vuelo y
          <span
            class="block sm:inline sm:ml-2 drop-shadow-[0_4px_16px_color-mix(in_srgb,var(--color-primary)_40%,transparent)]"
          >
            <span
              class="bg-linear-to-r from-secondary via-primary to-tertiary bg-clip-text text-transparent"
            >
              Confiabilidad en Tiempo Real
            </span>
          </span>
        </h1>

        <p
          class="text-xs sm:text-sm lg:text-base text-text-muted max-w-2xl leading-relaxed mt-1"
        >
          Análisis de demoras, puntualidad OTP-15 y telemetría histórica para
          aerolíneas comerciales y viajeros frecuentes.
        </p>
      </div>

      <div v-if="compact" class="flex flex-wrap items-center gap-2 pt-1">
        <div
          v-for="feat in features"
          :key="feat.title"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-card/70 border border-border-subtle backdrop-blur-xs text-text-main"
        >
          <UIcon :name="feat.icon" class="size-3.5 text-primary shrink-0" />
          <span>{{ feat.title }}</span>
        </div>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div class="flex lg:hidden flex-wrap items-center gap-2 pt-1">
          <div
            v-for="feat in features"
            :key="feat.title"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-card/80 border border-border-subtle backdrop-blur-xs text-text-main"
          >
            <UIcon :name="feat.icon" class="size-3.5 text-primary shrink-0" />
            <span>{{ feat.title }}</span>
          </div>
        </div>

        <div class="hidden lg:grid grid-cols-3 gap-3.5 pt-2">
          <div
            v-for="feat in features"
            :key="feat.title"
            class="group p-3.5 rounded-xl bg-surface-card/60 hover:bg-surface-elevated/80 border border-border-subtle hover:border-primary/40 backdrop-blur-md transition-all duration-200 flex flex-col gap-1.5 shadow-xs"
          >
            <div class="flex items-center justify-between">
              <div
                class="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform"
              >
                <UIcon :name="feat.icon" class="size-4 shrink-0" />
              </div>
            </div>
            <h2 class="text-sm font-semibold text-text-main mt-0.5">
              {{ feat.title }}
            </h2>
            <p class="text-xs text-text-muted line-clamp-2 leading-snug">
              {{ feat.description }}
            </p>
          </div>
        </div>

        <div class="hidden lg:flex items-center gap-3 pt-2">
          <span class="text-xs text-text-dim">Dejá tu estrella en GitHub:</span>
          <ULink
            to="https://github.com/delforrr/FlyWise"
            target="_blank"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border-subtle"
            aria-label="Repositorio de FlyWise en GitHub"
          >
            <UIcon name="i-lucide-github" class="size-4 shrink-0" />
            <span>delforrr/FlyWise</span>
            <UIcon name="i-lucide-external-link" class="size-3 opacity-60" />
          </ULink>
        </div>
      </div>
    </div>
  </div>
</template>
