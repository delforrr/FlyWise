<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

/**
 * Estado reactivo compartido para el modal de atajos de cabina.
 * Compartido con useCockpitShortcuts() y activable mediante tecla '?' o botón HUD.
 */
const isOpen = useState<boolean>('cockpit_shortcuts_modal', () => false);

/**
 * Listener de teclado local para alternar o cerrar el modal con '?' cuando está activo,
 * respetando el aislamiento de campos de texto interactivos.
 */
function handleKeyDown(e: KeyboardEvent): void {
  if (!isOpen.value) return;

  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      Boolean(target.closest('[role="combobox"]')))
  ) {
    return;
  }

  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault();
    isOpen.value = false;
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }
});
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Manual Operativo de Vuelo"
    description="Atajos de teclado tácticos para control de mapa y navegación"
    close-icon="i-lucide-x"
    :ui="{
      content:
        'sm:max-w-2xl bg-surface-card/95 dark:bg-surface-base/95 backdrop-blur-2xl border border-border-subtle border-t-white/35 dark:border-t-white/15 rounded-2xl shadow-2xl p-0 overflow-hidden divide-y divide-border-subtle/60',
      header:
        'p-5 sm:px-6 bg-surface-card/60 dark:bg-surface-base/60 flex items-start justify-between gap-4',
      body: 'p-5 sm:p-6 space-y-6',
      footer:
        'p-4 sm:px-6 bg-surface-accent/40 dark:bg-surface-elevated/20 flex items-center justify-between',
      close:
        'top-5 end-5 cursor-pointer text-text-muted hover:text-text-main hover:bg-surface-accent p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    }"
  >
    <!-- Cabecera de Instrumentación Aeronáutica -->
    <template #title>
      <div class="flex items-center gap-3 select-none">
        <div
          class="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-[0_0_14px_rgba(56,189,248,0.2)] shrink-0"
        >
          <UIcon name="i-lucide-keyboard" class="w-5 h-5" />
        </div>
        <div class="flex items-center gap-2">
          <span
            class="text-sm sm:text-base font-bold font-mono tracking-tight uppercase text-text-main"
          >
            Manual Operativo de Vuelo
          </span>
          <span
            class="hidden sm:inline-flex px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-primary/15 text-primary border border-primary/30"
          >
            Atajos de Cabina
          </span>
        </div>
      </div>
    </template>

    <template #description>
      <p class="text-xs text-text-muted mt-0.5">
        Atajos de teclado tácticos para control de mapa y navegación
      </p>
    </template>

    <!-- Cuerpo del Manual: Dos Columnas de Atajos Tácticos -->
    <template #body>
      <div
        class="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 font-feature-tech"
      >
        <!-- Columna A: 🎛️ Controles de Instrumentos de Vuelo -->
        <section
          class="flex flex-col gap-3 p-4 rounded-xl border border-border-subtle/80 bg-surface-accent/25 dark:bg-surface-elevated/20 shadow-xs"
          aria-labelledby="heading-flight-instruments"
        >
          <div
            class="flex items-center justify-between pb-2 border-b border-border-subtle/60"
          >
            <div class="flex items-center gap-2">
              <span class="text-base select-none" aria-hidden="true">🎛️</span>
              <h3
                id="heading-flight-instruments"
                class="text-xs font-mono font-bold uppercase tracking-wider text-text-main"
              >
                Controles de Instrumentos
              </h3>
            </div>
            <span
              class="text-[10px] font-mono text-primary font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20"
            >
              MAPA
            </span>
          </div>

          <div class="space-y-2.5">
            <!-- 3: Alternar perspectiva 2D / 3D -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Alternar perspectiva 2D / 3D
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  36° pitch o cenital plano
                </span>
              </div>
              <UKbd
                size="md"
                class="font-mono font-bold text-xs shadow-xs px-2.5 py-0.5 shrink-0 tabular-nums border border-border-subtle/80"
              >
                3
              </UKbd>
            </div>

            <!-- N: Orientar rumbo al Norte -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Orientar rumbo al Norte
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  Norte magnético (0°)
                </span>
              </div>
              <UKbd
                size="md"
                class="font-mono font-bold text-xs shadow-xs px-2.5 py-0.5 shrink-0 tabular-nums border border-border-subtle/80"
              >
                N
              </UKbd>
            </div>

            <!-- F: Reencuadrar cámara (Fit View) -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Reencuadrar cámara
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  Ajusta a la ruta o hub (Fit View)
                </span>
              </div>
              <UKbd
                size="md"
                class="font-mono font-bold text-xs shadow-xs px-2.5 py-0.5 shrink-0 tabular-nums border border-border-subtle/80"
              >
                F
              </UKbd>
            </div>

            <!-- Esc: Limpiar selección y resetear mapa -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Limpiar selección activa
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  Deseleccionar y resetear mapa
                </span>
              </div>
              <UKbd
                size="md"
                class="font-mono font-bold text-xs shadow-xs px-2 py-0.5 shrink-0 tabular-nums border border-border-subtle/80"
              >
                Esc
              </UKbd>
            </div>
          </div>
        </section>

        <!-- Columna B: ⚡ Comandos Globales de Cabina -->
        <section
          class="flex flex-col gap-3 p-4 rounded-xl border border-border-subtle/80 bg-surface-accent/25 dark:bg-surface-elevated/20 shadow-xs"
          aria-labelledby="heading-cockpit-commands"
        >
          <div
            class="flex items-center justify-between pb-2 border-b border-border-subtle/60"
          >
            <div class="flex items-center gap-2">
              <span class="text-base select-none" aria-hidden="true">⚡</span>
              <h3
                id="heading-cockpit-commands"
                class="text-xs font-mono font-bold uppercase tracking-wider text-text-main"
              >
                Comandos de Cabina
              </h3>
            </div>
            <span
              class="text-[10px] font-mono text-amber-500 dark:text-amber-400 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
            >
              SISTEMA
            </span>
          </div>

          <div class="space-y-2.5">
            <!-- Cmd+K / Ctrl+K: Cockpit Command Palette -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Command Palette
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  Abrir Cockpit Command Palette
                </span>
              </div>
              <div class="flex items-center gap-1 shrink-0 font-mono">
                <div class="inline-flex items-center gap-0.5">
                  <UKbd
                    size="md"
                    class="font-mono font-bold text-xs shadow-xs px-1.5 py-0.5 border border-border-subtle/80"
                  >
                    ⌘
                  </UKbd>
                  <UKbd
                    size="md"
                    class="font-mono font-bold text-xs shadow-xs px-1.5 py-0.5 border border-border-subtle/80"
                  >
                    K
                  </UKbd>
                </div>
                <span
                  class="text-[10px] font-mono text-text-muted px-0.5 uppercase"
                >
                  o
                </span>
                <div class="inline-flex items-center gap-0.5">
                  <UKbd
                    size="md"
                    class="font-mono font-bold text-xs shadow-xs px-1.5 py-0.5 border border-border-subtle/80"
                  >
                    Ctrl
                  </UKbd>
                  <UKbd
                    size="md"
                    class="font-mono font-bold text-xs shadow-xs px-1.5 py-0.5 border border-border-subtle/80"
                  >
                    K
                  </UKbd>
                </div>
              </div>
            </div>

            <!-- ?: Manual de atajos -->
            <div
              class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border-subtle/70 bg-surface-card/70 dark:bg-surface-base/50 hover:border-primary/40 hover:bg-surface-card transition-colors"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="text-xs font-semibold text-text-main leading-snug">
                  Manual de atajos
                </span>
                <span
                  class="text-[11px] font-mono text-text-muted mt-0.5 leading-tight"
                >
                  Abrir / cerrar este manual
                </span>
              </div>
              <UKbd
                size="md"
                class="font-mono font-bold text-xs shadow-xs px-2.5 py-0.5 shrink-0 tabular-nums border border-border-subtle/80"
              >
                ?
              </UKbd>
            </div>

            <!-- Telemetría y estado táctico de cabina -->
            <div
              class="p-3 rounded-lg border border-dashed border-border-subtle/80 bg-surface-card/40 dark:bg-surface-base/30 space-y-1.5"
            >
              <div class="flex items-center gap-1.5">
                <div
                  class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                />
                <span
                  class="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted"
                >
                  VINCULACIÓN WEBGL ACTIVA
                </span>
              </div>
              <p
                class="text-[11px] font-mono text-text-muted leading-relaxed"
              >
                Las teclas de cámara interactúan directamente con los motores
                MapLibre GL y Deck.gl sin latencia de interfaz.
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- Pie del Manual: Tip Táctico y Botón de Cierre -->
    <template #footer>
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3"
      >
        <div
          class="flex items-center gap-2.5 text-text-muted font-mono text-xs leading-relaxed"
        >
          <div
            class="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary shrink-0 border border-primary/20"
          >
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />
          </div>
          <span class="tabular-nums">
            Los atajos se pausan automáticamente al escribir en campos de
            búsqueda.
          </span>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Cerrar manual de atajos"
            class="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-main hover:bg-surface-accent border border-border-subtle/80 rounded-lg px-3 py-1.5 transition-all cursor-pointer"
            @click="isOpen = false"
          >
            <span>Cerrar</span>
            <UKbd
              size="sm"
              class="ml-1 font-mono text-[10px] px-1 py-0 border border-border-subtle"
            >
              Esc
            </UKbd>
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
