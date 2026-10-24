<script setup lang="ts">
import { useEtlMonitoring } from "~/features/etl-monitoring/composables/useEtlMonitoring";

const { logout } = useAuth();
const signingOut = ref(false);
const logoutError = ref('');
async function signOut() {
  signingOut.value = true;
  logoutError.value = '';
  try { await logout(); } catch { logoutError.value = 'No pudimos cerrar la sesión. Intentá nuevamente.'; }
  finally { signingOut.value = false; }
}

const route = useRoute();
const isUsersPage = computed(() => route.path.startsWith("/admin/usuarios"));

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
      :class="
        isUsersPage
          ? 'bg-surface-card border-b border-border-subtle/50'
          : 'sticky top-0 z-40 bg-surface-card/95 backdrop-blur-md border-b border-border-subtle shadow-xs'
      "
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
            color="neutral"
            variant="subtle"
            size="sm"
            class="text-xs font-medium"
          >
            Administración
          </UBadge>

          <!-- Enlaces de Navegación de la Consola -->
          <nav
            class="hidden lg:flex items-center gap-1.5 ml-3 pl-3 border-l border-border-subtle"
            aria-label="Navegación administrativa"
          >
            <UButton
              to="/admin"
              size="xs"
              :variant="$route.path === '/admin' ? 'subtle' : 'ghost'"
              :color="$route.path === '/admin' ? 'primary' : 'neutral'"
              icon="i-lucide-activity"
              class="text-xs font-semibold cursor-pointer"
            >
              Monitoreo
            </UButton>
            <UButton
              to="/admin/servicios"
              size="xs"
              :variant="
                $route.path.startsWith('/admin/servicios') ? 'subtle' : 'ghost'
              "
              :color="
                $route.path.startsWith('/admin/servicios')
                  ? 'primary'
                  : 'neutral'
              "
              icon="i-lucide-database"
              class="text-xs font-semibold cursor-pointer"
            >
              Servicios & Pipelines
            </UButton>
            <UButton
              to="/admin/usuarios"
              size="xs"
              :variant="isUsersPage ? 'subtle' : 'ghost'"
              color="neutral"
              icon="i-lucide-users"
              :aria-current="isUsersPage ? 'page' : undefined"
              >Usuarios</UButton
            >
          </nav>
        </div>

        <!-- Navegación y Controles de Cabecera -->
        <div class="flex items-center gap-2.5 sm:gap-3">
          <!-- Acceso al Explorador Público -->
          <UButton
            to="/explorar"
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-globe"
            class="hidden lg:inline-flex rounded-lg text-xs font-medium"
          >
            Ver Mapa Global
          </UButton>

          <!-- Conmutador de Tema Claro/Oscuro -->
          <ThemeToggle />
          <UButton icon="i-lucide-log-out" variant="ghost" color="neutral" size="xs" :loading="signingOut" aria-label="Cerrar sesión" @click="signOut">Salir</UButton>

          <USeparator v-if="!isUsersPage" orientation="vertical" class="h-4" />

          <!-- Identificador de Operador -->
          <div v-if="!isUsersPage" class="flex items-center gap-2">
            <UAvatar text="OP" size="xs" class="font-mono text-xs font-bold" />
            <span
              class="hidden lg:inline text-xs font-semibold text-text-main font-mono"
            >
              Operador ETL
            </span>
          </div>
        </div>
      </div>
      <nav
        class="lg:hidden max-w-7xl mx-auto flex items-center gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-3 text-sm"
        aria-label="Navegación administrativa móvil"
      >
        <NuxtLink to="/admin" class="whitespace-nowrap">Monitoreo</NuxtLink>
        <NuxtLink to="/admin/servicios" class="whitespace-nowrap"
          >Servicios</NuxtLink
        >
        <NuxtLink
          to="/admin/usuarios"
          :aria-current="isUsersPage ? 'page' : undefined"
          :class="
            isUsersPage ? 'font-semibold text-text-main' : 'text-text-muted'
          "
          >Usuarios</NuxtLink
        >
      </nav>
    </header>

    <!-- Contenedor Principal -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <p v-if="logoutError" role="alert" class="mb-4 text-sm text-error">{{ logoutError }}</p>
      <slot />
    </main>

    <!-- Pie de Página Minimalista -->
    <footer class="border-t border-border-subtle bg-surface-card py-4 mt-auto">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted"
      >
        <div>FlyWise - 2026</div>
        <div
          class="text-xs text-text-muted"
          :class="{ 'font-mono': !isUsersPage }"
        >
          Sistema de Información de vuelos comerciales y Exploración de Rutas
          Aéreas
        </div>
      </div>
    </footer>
  </div>
</template>
