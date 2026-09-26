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
          <USeparator orientation="vertical" class="h-4" />
          <UBadge color="primary" variant="subtle" size="sm">
            Consola ETL
          </UBadge>
        </div>

        <!-- Navegación y Controles de Cabecera -->
        <div class="flex items-center gap-3">
          <!-- Indicador de Salud de Workers -->
          <UBadge color="success" variant="subtle" size="sm" class="hidden sm:inline-flex gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Colas BullMQ Activas</span>
          </UBadge>

          <!-- Acceso al Explorador Público -->
          <UButton to="/explorar" variant="outline" color="neutral" size="xs" icon="i-lucide-globe">
            Ver Mapa Global
          </UButton>

          <!-- Conmutador de Tema Claro/Oscuro (Auto-importado) -->
          <ThemeToggle />

          <USeparator orientation="vertical" class="h-4" />

          <!-- Identificador de Operador -->
          <div class="flex items-center gap-2">
            <UAvatar text="OP" size="xs" />
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
