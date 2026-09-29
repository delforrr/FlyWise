<script setup lang="ts">
const isPaletteOpen = useState('cockpit_command_palette_open', () => false);
const searchTerm = ref('');

const route = useRoute();
const colorMode = useColorMode();
const flightMap = useFlightMap();
const flightSelection = useFlightSelection();

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  suffix?: string;
  kbds?: string[];
  onSelect?: () => void | Promise<void>;
  [key: string]: unknown;
}

interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
  [key: string]: unknown;
}

// -------------------------------------------------------------
// Acciones operativas de cabina
// -------------------------------------------------------------
async function selectAirport(iata: string) {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  flightSelection.setOrigin(iata);
  if (route.path !== '/explorar') {
    await navigateTo('/explorar');
  }
}

async function handleToggle3D() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  if (route.path !== '/explorar') {
    await navigateTo('/explorar');
  }
  flightMap.toggle3D();
}

async function handleResetNorth() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  if (route.path !== '/explorar') {
    await navigateTo('/explorar');
  }
  flightMap.resetNorth();
}

async function handleFitRoute() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  if (route.path !== '/explorar') {
    await navigateTo('/explorar');
  }
  flightSelection.triggerFit();
}

function handleClearSelection() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  flightSelection.clearSelection();
}

async function handleNavigate(path: string) {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  if (route.path !== path) {
    await navigateTo(path);
  }
}

function handleToggleTheme() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}

function handleOpenShortcuts() {
  isPaletteOpen.value = false;
  searchTerm.value = '';
  useState('cockpit_shortcuts_modal', () => false).value = true;
}

// -------------------------------------------------------------
// Catálogo de Comandos Tácticos Categorizados
// -------------------------------------------------------------
const groups = computed<PaletteGroup[]>(() => [
  {
    id: 'airports',
    label: '🛫 Aeropuertos Populares & Hubs',
    items: [
      {
        id: 'airport-eze',
        label: 'EZE — Buenos Aires (Ezeiza)',
        description: 'Aeropuerto Internacional Ministro Pistarini, Argentina',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Cono Sur',
        onSelect: () => selectAirport('EZE'),
      },
      {
        id: 'airport-mad',
        label: 'MAD — Madrid (Barajas)',
        description: 'Aeropuerto Adolfo Suárez Madrid-Barajas, España',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Europa',
        onSelect: () => selectAirport('MAD'),
      },
      {
        id: 'airport-mia',
        label: 'MIA — Miami International',
        description: 'Miami International Airport, Estados Unidos',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Norte',
        onSelect: () => selectAirport('MIA'),
      },
      {
        id: 'airport-jfk',
        label: 'JFK — New York (JFK)',
        description: 'John F. Kennedy International Airport, Estados Unidos',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Costa Este',
        onSelect: () => selectAirport('JFK'),
      },
      {
        id: 'airport-bog',
        label: 'BOG — Bogotá (El Dorado)',
        description: 'Aeropuerto Internacional El Dorado, Colombia',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Andino',
        onSelect: () => selectAirport('BOG'),
      },
      {
        id: 'airport-gru',
        label: 'GRU — São Paulo (Guarulhos)',
        description: 'Aeroporto Internacional de São Paulo-Guarulhos, Brasil',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Sudamérica',
        onSelect: () => selectAirport('GRU'),
      },
      {
        id: 'airport-scl',
        label: 'SCL — Santiago de Chile',
        description: 'Aeropuerto Internacional Arturo Merino Benítez, Chile',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Pacífico',
        onSelect: () => selectAirport('SCL'),
      },
      {
        id: 'airport-cor',
        label: 'COR — Córdoba (Pajas Blancas)',
        description: 'Aeropuerto Internacional Ing. Ambrosio Taravella, Argentina',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Central',
        onSelect: () => selectAirport('COR'),
      },
      {
        id: 'airport-lim',
        label: 'LIM — Lima (Jorge Chávez)',
        description: 'Aeropuerto Internacional Jorge Chávez, Perú',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Pacífico',
        onSelect: () => selectAirport('LIM'),
      },
      {
        id: 'airport-gig',
        label: 'GIG — Río de Janeiro (Galeão)',
        description: 'Aeroporto Internacional Antônio Carlos Jobim, Brasil',
        icon: 'i-lucide-plane-takeoff',
        suffix: 'Hub Atlántico',
        onSelect: () => selectAirport('GIG'),
      },
    ],
  },
  {
    id: 'map-actions',
    label: '⚡ Acciones Rápidas de Mapa',
    items: [
      {
        id: 'action-toggle-3d',
        label: 'Alternar perspectiva 2D / 3D',
        description: 'Cambiar inclinación y ángulo visual del mapa de navegación',
        icon: 'i-lucide-box',
        kbds: ['3'],
        onSelect: () => handleToggle3D(),
      },
      {
        id: 'action-reset-north',
        label: 'Orientar mapa al Norte (0°)',
        description: 'Restablecer orientación azimutal de navegación a 0°',
        icon: 'i-lucide-compass',
        kbds: ['N'],
        onSelect: () => handleResetNorth(),
      },
      {
        id: 'action-fit-route',
        label: 'Reencuadrar cámara a la ruta',
        description: 'Ajustar la cámara a los puntos de vuelo y hubs seleccionados',
        icon: 'i-lucide-focus',
        kbds: ['F'],
        onSelect: () => handleFitRoute(),
      },
      {
        id: 'action-clear-selection',
        label: 'Limpiar selección de ruta',
        description: 'Deseleccionar origen, destino y reiniciar visualización global',
        icon: 'i-lucide-rotate-ccw',
        kbds: ['Esc'],
        onSelect: () => handleClearSelection(),
      },
    ],
  },
  {
    id: 'navigation',
    label: '🧭 Navegación del Sistema',
    items: [
      {
        id: 'nav-explorar',
        label: 'Explorador de Rutas y Puntualidad',
        description: 'Visualizador geoespacial interactivo y auditoría OTP-15',
        icon: 'i-lucide-map',
        suffix: '/explorar',
        onSelect: () => handleNavigate('/explorar'),
      },
      {
        id: 'nav-admin',
        label: 'Consola de Monitoreo ETL',
        description: 'Estado de pipelines, métricas de ingesta y auditoría de descartes',
        icon: 'i-lucide-activity',
        suffix: '/admin',
        onSelect: () => handleNavigate('/admin'),
      },
      {
        id: 'nav-login',
        label: 'Iniciar Sesión Administrativa',
        description: 'Panel de acceso y credenciales para operadores',
        icon: 'i-lucide-lock',
        suffix: '/login',
        onSelect: () => handleNavigate('/login'),
      },
      {
        id: 'nav-home',
        label: 'Inicio / Portada',
        description: 'Pantalla principal del sistema FlyWise',
        icon: 'i-lucide-home',
        suffix: '/',
        onSelect: () => handleNavigate('/'),
      },
    ],
  },
  {
    id: 'cabin',
    label: '🌓 Preferencia de Cabina',
    items: [
      {
        id: 'action-toggle-theme',
        label: 'Alternar Modo Claro / Oscuro',
        description: 'Cambiar el esquema de iluminación instrumental de cabina',
        icon: 'i-lucide-sun-moon',
        kbds: ['T'],
        onSelect: () => handleToggleTheme(),
      },
    ],
  },
  {
    id: 'manual',
    label: '❓ Manual de Cabina',
    items: [
      {
        id: 'action-shortcuts',
        label: 'Ver atajos de teclado (?)',
        description: 'Desplegar la guía de comandos y atajos operacionales',
        icon: 'i-lucide-help-circle',
        kbds: ['?'],
        onSelect: () => handleOpenShortcuts(),
      },
    ],
  },
]);

// -------------------------------------------------------------
// Listener Global de Atajo (Ctrl+K / Cmd+K)
// -------------------------------------------------------------
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    isPaletteOpen.value = !isPaletteOpen.value;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

function handlePaletteSelect(item: unknown) {
  if (!item || typeof item !== 'object') return;
  isPaletteOpen.value = false;
  searchTerm.value = '';
}
</script>

<template>
  <UModal
    v-model:open="isPaletteOpen"
    title="Paleta de Comandos de Cabina"
    description="Acceso rápido a aeropuertos, controles de mapa y navegación de vuelo"
    :ui="{
      overlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50',
      content:
        'relative top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-xl sm:max-w-2xl bg-surface-card/95 dark:bg-surface-base/95 backdrop-blur-2xl border border-border-subtle shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden ring-1 ring-white/10 z-50 focus:outline-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent',
    }"
  >
    <template #content>
      <!-- Cabezal Táctico Avionics -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-border-subtle/70 bg-surface-card/40"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="flex items-center justify-center size-6 rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-xs"
          >
            <UIcon name="i-lucide-command" class="size-3.5" />
          </div>
          <div class="flex items-center gap-2">
            <span
              class="font-mono text-xs font-bold text-text-main tracking-tight uppercase"
            >
              Cockpit Command Center
            </span>
            <span
              class="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono font-semibold uppercase tracking-wider"
            >
              Avionics
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UKbd value="esc" size="sm" class="font-mono text-[10px]" />
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            class="rounded-lg text-text-muted hover:text-text-main cursor-pointer"
            aria-label="Cerrar paleta de comandos"
            @click="isPaletteOpen = false"
          />
        </div>
      </div>

      <!-- Paleta de Comandos Nuxt UI -->
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        placeholder="Buscar comando, aeropuerto (IATA) o acción de vuelo..."
        autofocus
        :fuse="{
          fuseOptions: {
            threshold: 0.2,
            keys: ['label', 'description', 'suffix', 'id'],
          },
          resultLimit: 25,
        }"
        :ui="{
          root: 'divide-y divide-border-subtle/50 bg-transparent min-h-0',
          input:
            '[&>input]:h-12 [&>input]:text-xs [&>input]:font-mono [&>input]:placeholder:text-text-muted [&>input]:text-text-main [&>input]:bg-transparent',
          group: 'p-1.5 isolate',
          label:
            'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted',
          item: 'group relative w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-mono transition-colors text-text-main hover:bg-surface-accent data-highlighted:bg-surface-accent cursor-pointer select-none',
          itemLabel: 'text-text-main font-medium text-xs',
          itemDescription: 'text-[11px] text-text-muted truncate',
          itemLeadingIcon: 'size-4 text-primary shrink-0',
          itemTrailing: 'ms-auto inline-flex items-center gap-1.5',
          itemTrailingKbds: 'inline-flex items-center shrink-0 gap-1',
          empty: 'py-8 text-center text-xs font-mono text-text-muted',
          viewport: 'max-h-80 overflow-y-auto divide-y divide-border-subtle/40',
        }"
        @update:model-value="handlePaletteSelect"
      >
        <template #footer>
          <div
            class="flex items-center justify-between px-3.5 py-2.5 text-[11px] font-mono text-text-muted border-t border-border-subtle/60 bg-surface-card/60"
          >
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <UKbd value="↑" size="sm" />
                <UKbd value="↓" size="sm" />
                <span class="text-text-dim text-[10px]">Navegar</span>
              </span>
              <span class="flex items-center gap-1">
                <UKbd value="enter" size="sm" />
                <span class="text-text-dim text-[10px]">Ejecutar</span>
              </span>
              <span class="flex items-center gap-1">
                <UKbd value="esc" size="sm" />
                <span class="text-text-dim text-[10px]">Cerrar</span>
              </span>
            </div>

            <div
              class="hidden sm:flex items-center gap-1.5 text-[10px] text-text-dim font-mono"
            >
              <span
                class="size-1.5 rounded-full bg-emerald-500 animate-pulse"
              />
              <span>SISTEMA AVIONICS: ACTIVO</span>
            </div>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
