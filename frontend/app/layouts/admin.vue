<script setup lang="ts">
const { user, logout } = useAuth();
const username = computed(() => user.value?.correo.split("@")[0] ?? "");
const signingOut = ref(false);
const logoutError = ref("");
async function signOut() {
  signingOut.value = true;
  logoutError.value = "";
  try {
    await logout();
  } catch {
    logoutError.value = "No pudimos cerrar la sesión. Intentá nuevamente.";
  } finally {
    signingOut.value = false;
  }
}

const menuOpen = ref(false);
const route = useRoute();
const isUsersPage = computed(() => route.path.startsWith("/admin/usuarios"));
const sections = [
  { label: "Monitoreo", to: "/admin", icon: "i-lucide-activity" },
  { label: "Servicios", to: "/admin/servicios", icon: "i-lucide-server" },
  { label: "Usuarios", to: "/admin/usuarios", icon: "i-lucide-users" },
  { label: "Operaciones", to: "/admin/vuelos", icon: "i-lucide-plane-takeoff" },
  { label: "BTS mensual", to: "/admin/bts", icon: "i-lucide-calendar-days" },
  { label: "Aeropuertos", to: "/admin/aeropuertos", icon: "i-lucide-map-pin" },
  { label: "Aerolíneas", to: "/admin/aerolineas", icon: "i-lucide-plane" },
  { label: "Rutas", to: "/admin/rutas", icon: "i-lucide-route" },
  { label: "Actividad ANAC", to: "/admin/actividad", icon: "i-lucide-chart-column" },
  { label: "Indicadores", to: "/admin/indicadores", icon: "i-lucide-chart-line" },
];
const navigation = computed(() =>
  (user.value?.rol === "ADMIN" ? sections : sections.slice(0, 3)).map(item => ({
    ...item,
    exact: true,
    onSelect: () => { menuOpen.value = false; },
  })),
);
</script>

<template>
  <div
    class="min-h-screen bg-background text-text-main flex flex-col font-sans"
  >
    <header class="sticky top-0 z-40 border-b border-border-subtle bg-surface-card">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="flex items-center gap-2 group cursor-pointer">
            <span
              class="font-display font-bold text-xl text-text-main tracking-tight group-hover:text-primary transition-colors"
            >
              FlyWise
            </span>
          </NuxtLink>
          <span class="hidden sm:inline text-sm text-text-muted">Administración</span>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-3">
          <UButton
            to="/explorar"
            variant="outline"
            color="neutral"
            size="xs"
            icon="i-lucide-globe"
            class="hidden xl:inline-flex"
          >
            Ver mapa
          </UButton>

          <ThemeToggle />
          <UButton
            icon="i-lucide-log-out"
            variant="ghost"
            color="neutral"
            size="xs"
            :loading="signingOut"
            aria-label="Cerrar sesión"
            @click="signOut"
            ><span class="hidden sm:inline">Salir</span></UButton
          >

          <USeparator v-if="!isUsersPage" orientation="vertical" class="h-4" />

          <div
            v-if="!isUsersPage && user"
            class="flex items-center gap-2"
            :title="user.correo"
          >
            <UAvatar
              :alt="username"
              size="xs"
              class="text-xs font-semibold"
            />
            <span
              class="sr-only xl:not-sr-only xl:max-w-28 xl:truncate text-xs text-text-muted"
            >
              {{ username }}
            </span>
          </div>
          <UDrawer
            v-model:open="menuOpen"
            direction="right"
            title="Administración"
            :handle="false"
            :close="{ 'aria-label': 'Cerrar menú' }"
            :ui="{ content: 'w-[min(22rem,calc(100vw-2rem))]', body: 'overflow-y-auto' }"
          >
            <UButton
              class="min-h-11 xl:hidden"
              icon="i-lucide-menu"
              variant="ghost"
              color="neutral"
              aria-label="Abrir menú administrativo"
            />
            <template #body>
              <UNavigationMenu
                :items="navigation"
                orientation="vertical"
                color="neutral"
                aria-label="Navegación administrativa"
                :ui="{ link: 'min-h-11' }"
              />
            </template>
            <template #footer>
              <UButton to="/explorar" icon="i-lucide-globe" color="neutral" variant="ghost" @click="menuOpen = false">
                Ver mapa
              </UButton>
            </template>
          </UDrawer>
        </div>
      </div>
      <UNavigationMenu
        :items="navigation"
        color="neutral"
        variant="link"
        aria-label="Navegación administrativa"
        class="hidden max-w-7xl mx-auto px-8 pb-2 xl:flex"
        :ui="{ link: 'whitespace-nowrap', linkLabel: 'overflow-visible' }"
      />
    </header>

    <!-- Contenedor Principal -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <p v-if="logoutError" role="alert" class="mb-4 text-sm text-error">
        {{ logoutError }}
      </p>
      <slot />
    </main>

  </div>
</template>
