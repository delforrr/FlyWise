<script setup lang="ts">
import { useEtlMonitoring } from "~/features/etl-monitoring/composables/useEtlMonitoring";

const {
  globalMetrics,
  refreshInterval,
  isRefreshing,
  simulatedLatencyMs,
  setRefreshInterval,
  triggerManualRefresh,
} = useEtlMonitoring();
</script>

<template>
  <div
    class="min-h-screen bg-background text-text-main flex flex-col font-sans"
  >
    <!-- Cabecera Administrativa Minimalista (Sólida, borde nítido de 1px con sutil specular highlight) -->
    <header
      class="sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md border-b border-border-subtle shadow-xs"
    >
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
      >
        <!-- Logo y Badge Operativo -->
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="flex items-center gap-2 group cursor-pointer">
            <span
              class="font-display font-bold text-xl text-text-main tracking-tight group-hover:text-primary transition-colors"
            >
              FlyWise
            </span>
          </NuxtLink>
          <USeparator orientation="vertical" class="h-4" />
          <UBadge
            color="primary"
            variant="subtle"
            size="sm"
            class="font-mono text-xs font-semibold"
          >
            Consola ETL
          </UBadge>
        </div>

        <!-- Navegación y Controles de Cabecera -->
        <div class="flex items-center gap-2.5 sm:gap-3">
          <!-- Selector de Cadencia de Auto-refresco -->
          <fieldset
            class="hidden sm:flex items-center gap-0.5 border border-border-subtle rounded-lg p-0.5 bg-surface-accent/50 text-[11px] font-mono"
            aria-label="Frecuencia de actualización en vivo"
          >
            <button
              type="button"
              class="px-2 py-0.5 rounded cursor-pointer transition-colors"
              :class="
                refreshInterval === 5000
                  ? 'bg-surface-card text-text-main font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              "
              title="Actualización continua cada 5 segundos"
              @click="setRefreshInterval(5000)"
            >
              5s
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded cursor-pointer transition-colors"
              :class="
                refreshInterval === 15000
                  ? 'bg-surface-card text-text-main font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              "
              title="Actualización cada 15 segundos"
              @click="setRefreshInterval(15000)"
            >
              15s
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded cursor-pointer transition-colors"
              :class="
                refreshInterval === 0
                  ? 'bg-surface-card text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              "
              title="Congelar actualización automática para auditar incidencias"
              @click="setRefreshInterval(0)"
            >
              Pausar
            </button>
            <UTooltip text="Refrescar métricas ahora">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                class="w-6 h-6 p-0 rounded cursor-pointer text-text-muted hover:text-primary flex items-center justify-center"
                aria-label="Refrescar métricas ahora"
                @click="triggerManualRefresh"
              >
                <UIcon
                  name="i-lucide-refresh-cw"
                  class="w-3.5 h-3.5"
                  :class="{ 'animate-spin text-primary': isRefreshing }"
                />
              </UButton>
            </UTooltip>
          </fieldset>

          <!-- Acceso al Explorador Público -->
          <UButton
            to="/explorar"
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-globe"
            class="hidden md:inline-flex rounded-lg text-xs font-medium"
          >
            Ver Mapa Global
          </UButton>

          <!-- Conmutador de Tema Claro/Oscuro -->
          <ThemeToggle />

          <USeparator orientation="vertical" class="h-4" />

          <!-- Identificador de Operador -->
          <div class="flex items-center gap-2">
            <UAvatar text="OP" size="xs" class="font-mono text-xs font-bold" />
            <span
              class="hidden lg:inline text-xs font-semibold text-text-main font-mono"
            >
              Operador ETL
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- Contenedor Principal -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <slot />
    </main>

    <!-- Pie de Página Minimalista -->
    <footer class="border-t border-border-subtle bg-surface-card py-4 mt-auto">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted"
      >
        <div>FlyWise - 2026</div>
        <div class="font-mono text-[11px] text-text-dim">
          Sistema de Información de vuelos comerciales y Exploración de Rutas
          Aéreas
        </div>
      </div>
    </footer>
  </div>
</template>
