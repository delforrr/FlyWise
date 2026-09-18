<script setup lang="ts">
interface Props {
  compact?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  class: "",
});
</script>

<template>
  <div
    :class="[
      'relative flex flex-col justify-center w-full max-w-3xl lg:max-w-none px-2 sm:px-4 lg:px-0 py-2 sm:py-4 lg:py-0',
      props.class,
    ]"
  >
    <div class="relative z-10 flex flex-col gap-4 sm:gap-6">
      <!-- Eyebrow Tag -->
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider uppercase text-primary bg-primary/10 border border-primary/25 shadow-2xs"
        >
          <span class="size-1.5 rounded-full bg-primary animate-pulse" />
          v1.0
        </span>
      </div>

      <!-- Título de Alto Impacto Editorial -->
      <div class="flex flex-col gap-2 mb-10 lg:mb-5">
        <h1
          class="text-3xl sm:text-5xl lg:text-[3.25rem] font-display font-extrabold tracking-[-0.035em] text-text-main leading-[1.08] text-balance"
        >
          Telemetría de Vuelos y
          <span class="text-primary block sm:inline">
            Confiabilidad en Tiempo Real</span
          >
        </h1>

        <p
          class="text-sm sm:text-base text-text-muted max-w-2xl leading-relaxed mt-1"
        >
          Auditoría de demoras y puntualidad histórica por aerolínea y ruta.
          Conocé la probabilidad de que tu próximo vuelo se retrase.
        </p>
      </div>

      <!-- Asymmetrical Telemetry Bento Grid (Desktop) -->
      <div class="hidden lg:flex flex-col gap-3 pt-1">
        <!-- Grid Asimétrico en Desktop -->
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <!-- Bento 1: Principal de Rutas y Radar (Col 7) -->
          <div
            class="sm:col-span-7 p-4 rounded-2xl bg-surface-card dark:bg-surface-card/70 border border-border-subtle hover:border-primary/50 backdrop-blur-xl shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-3 group"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div
                  class="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform"
                >
                  <UIcon name="i-lucide-globe" class="size-4.5 shrink-0" />
                </div>
                <div>
                  <h3
                    class="text-xs font-mono uppercase tracking-wider text-text-dim"
                  >
                    Malla Geodésica
                  </h3>
                  <h2 class="text-sm font-semibold text-text-main">
                    Exploración Deck.gl
                  </h2>
                </div>
              </div>
              <span
                class="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md"
                >60 FPS</span
              >
            </div>
            <p class="text-xs text-text-muted leading-relaxed">
              Renderizado acelerado por hardware para arcos ortodrómicos y nodos
              IATA globales.
            </p>
          </div>

          <!-- Bento 2: Scorecard OTP-15 (Col 5) -->
          <div
            class="sm:col-span-5 p-4 rounded-2xl bg-surface-card dark:bg-surface-card/70 border border-border-subtle hover:border-success/50 backdrop-blur-xl shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-2 group"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div
                  class="p-2 rounded-xl bg-success/10 text-success border border-success/20 group-hover:scale-105 transition-transform"
                >
                  <UIcon
                    name="i-lucide-check-circle"
                    class="size-4.5 shrink-0"
                  />
                </div>
                <h3
                  class="text-xs font-mono uppercase tracking-wider text-text-dim"
                >
                  Estándar OTP-15
                </h3>
              </div>
              <span
                class="text-xs font-mono font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-md"
                >≤ 15m</span
              >
            </div>
            <div class="flex items-baseline gap-2">
              <span
                class="text-2xl font-display font-extrabold text-text-main tracking-tight"
                >88.4%</span
              >
              <span class="text-xs text-text-muted">Promedio Red Global</span>
            </div>
          </div>
        </div>

        <!-- Enlace a GitHub con contraste mejorado (Oculto en móviles < sm) -->
        <div class="hidden lg:flex items-center gap-3 pt-1">
          <span class="text-xs text-text-muted font-mono"
            >// Dejá tu estrella:</span
          >
          <ULink
            to="https://github.com/delforrr/FlyWise"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-text-main hover:text-primary transition-colors py-1.5 px-3 rounded-xl bg-surface-card dark:bg-surface-card/80 hover:bg-surface-accent border border-border-subtle shadow-2xs"
            aria-label="Repositorio de FlyWise en GitHub"
          >
            <UIcon
              name="i-lucide-github"
              class="size-4 shrink-0 text-text-main"
            />
            <span>delforrr/FlyWise</span>
            <UIcon name="i-lucide-external-link" class="size-3 text-text-dim" />
          </ULink>
        </div>
      </div>
    </div>
  </div>
</template>
