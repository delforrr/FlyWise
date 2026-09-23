<template>
  <div class="min-h-screen bg-background text-text-main flex flex-col font-sans">
    <!-- Cabecera Administrativa Minimalista (Sólida, sin blur, sin glow, borde nítido de 1px) -->
    <header class="sticky top-0 z-40 bg-surface-card border-b border-border-subtle">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <!-- Logo y Badge Operativo -->
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="flex items-center gap-2 group cursor-pointer">
            <span class="font-display font-bold text-xl text-text-main tracking-tight group-hover:text-primary transition-colors">
              FlyWise
            </span>
          </NuxtLink>
          <span class="h-4 w-px bg-border-subtle" />
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-surface-accent text-primary border border-border-subtle">
            Consola ETL
          </span>
        </div>

        <!-- Navegación y Controles de Cabecera -->
        <div class="flex items-center gap-3">
          <!-- Indicador de Salud de Workers -->
          <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Colas BullMQ Activas</span>
          </div>

          <!-- Acceso al Explorador Público -->
          <NuxtLink
            to="/explorar"
            class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-accent text-text-muted hover:text-text-main transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UIcon name="i-lucide-globe" class="w-3.5 h-3.5" />
            <span class="hidden md:inline">Ver Mapa Global</span>
          </NuxtLink>

          <!-- Conmutador de Tema Claro/Oscuro (Auto-importado) -->
          <ThemeToggle />

          <!-- Identificador de Operador -->
          <div class="flex items-center gap-2 pl-2 border-l border-border-subtle">
            <div class="w-7 h-7 rounded-full bg-surface-accent border border-border-subtle flex items-center justify-center text-xs font-bold text-primary">
              OP
            </div>
            <span class="hidden lg:inline text-xs font-semibold text-text-main">
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
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
        <div>
          FlyWise Ingestion Engine — RNF-04 (Node.js Streams + BullMQ) & RNF-03 (PostGIS SRID 4326).
        </div>
        <div class="font-mono text-[11px] text-text-dim">
          Sistema Operativo de Telecomunicaciones Aéreas
        </div>
      </div>
    </footer>
  </div>
</template>
