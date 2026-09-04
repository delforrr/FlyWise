# 🚀 Guía Rápida & Crash Course: Nuxt 4 + Vue 3 + Nuxt UI

> **Proyecto:** FlyWise — Aeronautical Intelligence System  
> **Stack:** Nuxt 4 (Vue 3 Composition API) + Nuxt UI v4 + Tailwind CSS v4 + TypeScript

Esta guía está diseñada como un **manual práctico y de referencia rápida**. Aquí aprenderás cómo funciona el flujo de trabajo en Nuxt/Vue, cómo crear páginas y rutas dinámicas, el diccionario de clases implementadas en el sistema de diseño, la alternancia de temas (claro/oscuro) y una **tabla de paralelismos directa para desarrolladores provenientes de React + MUI v7 (Material UI)**.

---

## 📑 Tabla de Contenidos
1. [El Modelo Mental de Nuxt 4 & Vue 3](#1-el-modelo-mental-de-nuxt-4--vue-3)
2. [Estructura del Directorio `app/`](#2-estructura-del-directorio-app)
3. [Diccionario de Clases y Tokens del Sistema de Diseño](#3-diccionario-de-clases-y-tokens-del-sistema-de-diseño)
4. [Paralelismos: React + MUI v7 ➔ Vue 3 + Nuxt UI](#4-paralelismos-react--mui-v7-➔-vue-3--nuxt-ui)
5. [Cómo Crear una Nueva Página (Rutas y Parámetros)](#5-cómo-crear-una-nueva-página-rutas-y-parámetros)
6. [Vue 3 `<script setup>` en 5 Minutos](#6-vue-3-script-setup-en-5-minutos)
7. [Componentes y Auto-Imports](#7-componentes-y-auto-imports)
8. [Cómo Usar y Personalizar Nuxt UI](#8-cómo-usar-y-personalizar-nuxt-ui)
9. [Tema Claro / Oscuro Automático (`useColorMode`)](#9-tema-claro--oscuro-automático-usecolormode)
10. [Consumo de Datos y APIs (`useFetch` vs `$fetch`)](#10-consumo-de-datos-y-apis-usefetch-vs-fetch)
11. [Estado Global y Composables](#11-estado-global-y-composables)
12. [Componentes Solo Cliente (`ClientOnly` para Mapas/WebGL)](#12-componentes-solo-cliente-clientonly-para-mapaswebgl)
13. [Chuleta de Comandos Frecuentes](#13-chuleta-de-comandos-frecuentes)

---

## 1. El Modelo Mental de Nuxt 4 & Vue 3

Nuxt es un framework sobre Vue 3 que automatiza la arquitectura de tu aplicación:

1. **Auto-Imports Automáticos:** No necesitas hacer `import { ref, computed } from 'vue'` ni importar tus propios componentes o composables. Nuxt los detecta y los deja disponibles globalmente en cualquier archivo `.vue` o `.ts`.
2. **Enrutamiento Basado en Archivos (*File-based Routing*):** La estructura dentro de `app/pages/` genera automáticamente las rutas de URL de tu navegador.
3. **SSR (Server-Side Rendering) + Hidratación:** La página se renderiza primero en el servidor (para velocidad y SEO) y luego se activa en el navegador de forma reactiva.
4. **App Config & Design System:** Integración nativa con Tailwind CSS v4 y Nuxt UI para consistencia visual inmediata.

---

## 2. Estructura del Directorio `app/`

En Nuxt 4, todo el código fuente frontend vive dentro de `frontend/app/`:

```text
frontend/app/
├── app.vue               # Componente raíz (<UApp>, <NuxtLayout>, <NuxtPage>)
├── app.config.ts         # Configuración del tema de Nuxt UI (colores, defaults)
├── app.css               # Estilos globales, directivas @theme de Tailwind v4 y modo oscuro
├── components/           # Componentes Vue auto-importados
│   ├── common/
│   │   ├── OtpBadge.vue           -> <CommonOtpBadge /> o <OtpBadge />
│   │   └── ThemeToggle.vue        -> <CommonThemeToggle />
│   ├── routes/
│   │   └── RouteResultsPanel.vue  -> <RoutesRouteResultsPanel />
│   └── search/
│       └── FlightSearchBar.vue    -> <SearchFlightSearchBar />
├── composables/          # Lógica reactiva reutilizable (useRoutes.ts, useAirports.ts)
├── layouts/              # Plantillas de diseño (default.vue, admin.vue, fullscreen.vue)
├── pages/                # Vistas y páginas de la aplicación
│   ├── index.vue         # Ruta '/'
│   ├── login.vue         # Ruta '/login'
│   └── routes/
│       └── [id].vue      # Ruta dinámica '/routes/:id' (ej. /routes/EZE-MAD)
└── types/                # Definiciones de TypeScript (Airport.ts, Route.ts)
```

---

## 3. Diccionario de Clases y Tokens del Sistema de Diseño

En [`frontend/app/app.css`](file:///home/delforr/Documents/Universidad/3er%20a%C3%B1o/Desarrollo%20de%20Software/Proyecto/frontend/app/app.css) definimos las clases exactas para la temática de **Inteligencia Aeronáutica (FlyWise)**.

### 🎨 3.1 Colores y Superficies de Fondo

| Clase Tailwind | Color Modo Oscuro | Color Modo Claro | Uso y Significado |
| :--- | :--- | :--- | :--- |
| `bg-bg-base` | `#070b14` (Deep Space) | `#f8fafc` (Slate-50) | Fondo principal de toda la aplicación y mapa base. |
| `bg-surface-base` | `#0f1418` (Dark Cockpit) | `#ffffff` (Blanco) | Paneles HUD principales, modales y barra de navegación superior. |
| `bg-surface-elevated`| `#171c20` | `#f1f5f9` (Slate-100) | Desplegables, tooltips, flyouts y botones de control. |
| `bg-surface-card` | `#1b2024` | `#ffffff` (Blanco) | Filas de datos de aerolíneas, tarjetas anidadas y subtarjetas. |
| `border-border-subtle`| `#252b2e` | `#e2e8f0` (Slate-200) | Bordes suaves de separación entre componentes y paneles. |
| `border-border-hover` | `#3e484f` | `#cbd5e1` (Slate-300) | Bordes interactivos al hacer `:hover` sobre tarjetas o botones. |

---

### 📝 3.2 Texto y Contraste

| Clase Tailwind | Modo Oscuro | Modo Claro | Uso y Significado |
| :--- | :--- | :--- | :--- |
| `text-text-main` | `#dee3e8` (Slate-200) | `#0f172a` (Slate-900) | Títulos principales, valores numéricos clave y encabezados. |
| `text-text-muted` | `#87929a` (Slate-400) | `#64748b` (Slate-500) | Subtítulos, etiquetas secundarias, metadatos y labels. |
| `text-text-dim` | `#59656e` (Slate-600) | `#94a3b8` (Slate-400) | Placeholders, separadores e información de baja prioridad. |

---

### ✈️ 3.3 Marca y Acentos Aeronáuticos (HUD)

| Clase Tailwind | Valor Hex | Uso y Significado |
| :--- | :--- | :--- |
| `text-aero-cyan` / `bg-aero-cyan` | `#38bdf8` (Cyan) | Color primario de acción: rutas activas en mapa, focus rings, botones principales. |
| `text-aero-glow` | `#7bd0ff` | Resplandor geodésico en hover y destellos de radar. |
| `text-electric-cobalt` / `bg-electric-cobalt` | `#3b82f6` (Cobalt) | Color secundario: inicio de gradientes y enlaces secundarios. |

---

### 🚦 3.4 Semántica de Puntualidad (OTP-15)

| Clase Tailwind | Color | Criterio OTP-15 | Significado Aeronáutico |
| :--- | :--- | :--- | :--- |
| `text-otp-good` / `bg-otp-good` | `#10b981` (Emerald) | $\ge 85\%$ | **Excelente:** Alta puntualidad histórica y baja probabilidad de demoras. |
| `text-otp-warning` / `bg-otp-warning` | `#f59e0b` (Amber) | $60\% - 85\%$ | **Moderado:** Riesgo de retrasos medios (15-45 minutos). |
| `text-otp-critical` / `bg-otp-critical`| `#ef4444` (Crimson) | $< 60\%$ | **Crítico:** Alta probabilidad de demoras graves o cancelaciones de vuelo. |

---

### 🔤 3.5 Familias Tipográficas

| Clase Tailwind | Fuente | Uso Exclusivo |
| :--- | :--- | :--- |
| `font-display` | **Geist** | Títulos de secciones, marcas (`FlyWise`), encabezados de tarjetas HUD. |
| `font-sans` | **Inter** | Textos de párrafos, explicaciones analíticas, tooltips y botones. |
| `font-mono` | **JetBrains Mono** | Códigos IATA/ICAO (`EZE`, `MAD`), porcentajes (`91.2% OTP`), minutos de demora, timestamps y coordenadas. |

---

### 🧩 3.6 Utilidades HUD Compuestas (CSS)

| Clase CSS | Qué Estilos Aplica | Cuándo Usarla |
| :--- | :--- | :--- |
| `.hud-panel` | `backdrop-blur-xl`, fondo translúcido, borde 1px, `rounded-2xl`, sombra profunda. | Contenedor flotante de paneles (ej. buscador, panel de resultados, contenedor de mapa). |
| `.hud-card` | `backdrop-blur-md`, fondo sutil, borde tenue, `rounded-xl`. | Filas de aerolíneas o métricas dentro de un panel. |
| `.hud-input` | Fondo oscuro de cabina, borde sutil, anillo de foco en `Aero Cyan` con resplandor suave. | Campos de texto de búsqueda y selectores de fecha. |
| `.badge-otp-good` | Fondo verde esmeralda al 15% de opacidad + borde al 30% + texto verde 100%. | Badge tipo pill para vuelos con $\ge 85\%$ OTP. |
| `.badge-otp-warning`| Fondo ámbar al 15% de opacidad + borde al 30% + texto ámbar 100%. | Badge tipo pill para vuelos entre $60\%$ y $85\%$ OTP. |
| `.badge-otp-critical`| Fondo carmesí al 15% de opacidad + borde al 30% + texto carmesí 100%. | Badge tipo pill para vuelos con $< 60\%$ OTP. |
| `.btn-hud-primary` | Gradiente de Cobalto a Cyan + sombra brillante + microinteracción `active:scale-95`. | Botón principal de llamada a la acción (ej. "Explorar Ruta"). |

---

## 4. Paralelismos: React + MUI v7 ➔ Vue 3 + Nuxt UI

Si vienes de trabajar con **React** y **MUI (Material-UI v5 / v6 / v7)**, esta tabla traduce directamente los conceptos y patrones:

### 4.1 Reactividad & Hooks

| Concepto | React + Hooks | Vue 3 Composition API (`<script setup>`) | Notas / Ventajas en Vue |
| :--- | :--- | :--- | :--- |
| **Estado primitivo** | `const [count, setCount] = useState(0)` | `const count = ref(0)` | En el script se modifica `count.value++`; en el template se usa directamente `{{ count }}`. |
| **Estado objeto/array** | `const [user, setUser] = useState({ name: 'A' })` | `const user = ref({ name: 'A' })` | Mutación directa: `user.value.name = 'B'` sin recrear todo el objeto. |
| **Valor derivado / memoizado** | `const total = useMemo(() => a * 2, [a])` | `const total = computed(() => a.value * 2)` | En Vue **no necesitas array de dependencias**; las detecta automáticamente. |
| **Efecto al cambiar variable** | `useEffect(() => { ... }, [search])` | `watch(search, (newVal) => { ... })` | Solo se ejecuta cuando `search` cambia. |
| **Efecto al montar (Mount)** | `useEffect(() => { ... }, [])` | `onMounted(() => { ... })` | Hook explícito y limpio. |
| **Funciones / Callbacks** | `const handleClick = useCallback(() => {}, [])` | `const handleClick = () => {}` | En Vue **no existe `useCallback`** porque el setup se ejecuta una sola vez al instanciar. |

---

### 4.2 Plantillas, Props y Eventos

| Concepto | React (JSX / TSX) | Vue 3 (SFC `<template>`) |
| :--- | :--- | :--- |
| **Definir Props** | `interface Props { title: string }`<br>`function Comp({ title }: Props)` | `defineProps<{ title: string }>()` |
| **Emitir Eventos al Padre** | `function Comp({ onSelect })`<br>`<button onClick={() => onSelect(id)} />` | `const emit = defineEmits<{ (e: 'select', id: string): void }>()`<br>`<button @click="emit('select', id)" />` |
| **Binding Bidireccional (Inputs)** | `<input value={val} onChange={e => setVal(e.target.value)} />` | `<input v-model="val" />` |
| **Renderizado Condicional** | `{isLoading ? <Spinner /> : <Content />}` | `<Spinner v-if="isLoading" />`<br>`<Content v-else />` |
| **Renderizado de Listas** | `{items.map(item => <Item key={item.id} {...item} />)}` | `<Item v-for="item in items" :key="item.id" v-bind="item" />` |
| **Proyectar Contenido (Children)** | `<div>{children}</div>` | `<div><slot /></div>` |
| **Múltiples Slots (Named Children)**| `{header} ... {footer}` | `<slot name="header" /> ... <slot name="footer" />` |

---

### 4.3 Equivalencia de Componentes: MUI v7 ➔ Nuxt UI v4

| Componente | React + MUI v7 (`@mui/material`) | Nuxt 4 + Nuxt UI v4 (`@nuxt/ui`) |
| :--- | :--- | :--- |
| **Botón** | `<Button variant="contained" color="primary">` | `<UButton variant="solid" color="primary">` |
| **Campo de Texto** | `<TextField label="Origen" variant="outlined" />` | `<UInput placeholder="Origen" icon="i-lucide-plane" />` |
| **Badge / Insignia** | `<Chip label="92% OTP" color="success" />` | `<UBadge color="success" variant="subtle">92% OTP</UBadge>` |
| **Tarjeta / Panel** | `<Paper elevation={3} sx={{ p: 2 }}>` o `<Card>` | `<UCard>` o `<div class="hud-panel p-4">` |
| **Modal / Diálogo** | `<Dialog open={isOpen} onClose={handleClose}>` | `<UModal v-model:open="isOpen">` |
| **Menú Desplegable / Select** | `<Select value={val} onChange={...}>` | `<USelect v-model="val" :items="options" />` |
| **Tooltip** | `<Tooltip title="Info del vuelo">` | `<UTooltip text="Info del vuelo">` |
| **Tabla de Datos** | `<TableContainer><Table>...</Table></TableContainer>` | `<UTable :data="items" :columns="columns" />` |
| **Estilos inline / personalizados**| `<Box sx={{ display: 'flex', gap: 2, bgcolor: 'primary.main' }}>` | `<div class="flex gap-2 bg-aero-cyan">` (Tailwind) o prop `:ui="{ ... }"` |

---

### 4.4 Configuración de Tema y Modo Oscuro: MUI vs Nuxt UI

* **En React + MUI:**
  ```tsx
  // MUI ThemeProvider
  const theme = createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#38bdf8' },
    },
  });
  // useColorScheme() para alternar modo
  ```

* **En Nuxt 4 + Nuxt UI (Mucho más directo):**
  ```ts
  // frontend/app/app.config.ts
  export default defineAppConfig({
    ui: {
      colors: {
        primary: 'sky',    // Aero Cyan
        neutral: 'slate',  // Dark Cockpit
      },
    },
  })
  ```
  Y en cualquier componente:
  ```vue
  <script setup lang="ts">
  const colorMode = useColorMode() // 'system' | 'light' | 'dark'
  </script>
  ```

---

## 5. Cómo Crear una Nueva Página (Rutas y Parámetros)

### Ejemplo 1: Crear una página estática `/about.vue`
Crea el archivo `frontend/app/pages/about.vue`:

```vue
<template>
  <div class="max-w-4xl mx-auto p-6 space-y-4">
    <h1 class="text-2xl font-bold font-display text-text-main">Acerca de FlyWise</h1>
    <p class="text-text-muted">
      Plataforma de inteligencia de rutas y monitoreo de puntualidad aérea.
    </p>

    <!-- Enlace nativo con NuxtLink -->
    <NuxtLink to="/" class="text-aero-cyan hover:underline font-medium">
      ← Volver al Mapa Principal
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
// Metadatos SEO para esta página específica
useSeoMeta({
  title: 'Acerca de — FlyWise',
  description: 'Información del sistema de inteligencia aeronáutica',
})
</script>
```

---

### Ejemplo 2: Crear una ruta dinámica `/routes/[id].vue` (ej. `/routes/EZE-MAD`)
Crea el archivo `frontend/app/pages/routes/[id].vue`:

```vue
<template>
  <div class="p-6 space-y-6">
    <!-- Obtener el parámetro dinámico de la URL -->
    <div class="flex items-center justify-between border-b border-border-subtle pb-4">
      <div>
        <span class="text-xs font-mono text-text-muted uppercase">Tramo Seleccionado</span>
        <h1 class="text-3xl font-bold font-display text-text-main">{{ routeId }}</h1>
      </div>

      <UBadge color="success" variant="subtle" size="lg">
        91.5% OTP-15 Promedio
      </UBadge>
    </div>

    <p class="text-sm text-text-muted">
      Mostrando telemetría histórica y comparación de aerolíneas operadoras para el tramo {{ routeId }}.
    </p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// El nombre del archivo '[id].vue' define la clave en route.params
const routeId = computed(() => (route.params.id as string)?.toUpperCase() || 'EZE-MAD')

useSeoMeta({
  title: `Ruta ${routeId.value} — FlyWise`,
})
</script>
```

---

## 6. Vue 3 `<script setup>` en 5 Minutos

Vue 3 usa la **Composition API** con `<script setup lang="ts">`.

### Los conceptos clave de reactividad:

```vue
<script setup lang="ts">
// 1. Estado reactivo primitivo (ref) -> Eq. useState
const counter = ref(0)
const searchQuery = ref('EZE')

// 2. Estado reactivo para objetos complejos (ref)
const userFilters = ref({
  maxDelay: 15,
  onlyDirectFlights: true,
})

// 3. Propiedades computadas -> Eq. useMemo
const isHighDelayRisk = computed(() => userFilters.value.maxDelay > 30)

// 4. Funciones / Métodos -> Eq. useCallback / handler
const increment = () => {
  counter.value++ // En el script usas .value, en el <template> NO hace falta .value
}

// 5. Watchers -> Eq. useEffect con dependencias
watch(searchQuery, (newVal, oldVal) => {
  console.log(`Buscando aeropuerto: ${newVal}`)
})

// 6. Ciclo de vida -> Eq. useEffect(() => {}, [])
onMounted(() => {
  console.log('El componente ya está montado en el DOM')
})
</script>

<template>
  <div class="space-y-3">
    <p class="text-text-main font-mono">Contador: {{ counter }}</p>
    <p class="text-text-muted">Riesgo: {{ isHighDelayRisk ? '⚠️ Alto' : '✅ Normal' }}</p>
    <button @click="increment" class="btn-hud-primary px-4 py-2 text-sm">
      Incrementar
    </button>
  </div>
</template>
```

---

## 7. Componentes y Auto-Imports

### Creando un componente reutilizable
Crea `frontend/app/components/common/OtpBadge.vue`:

```vue
<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-tight',
      statusClass
    ]"
  >
    <span :class="['w-1.5 h-1.5 rounded-full', dotClass]"></span>
    {{ value }}% OTP-15
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number
    showDot?: boolean
  }>(),
  {
    showDot: true,
  }
)

const emit = defineEmits<{
  (e: 'click-badge', value: number): void
}>()

const statusClass = computed(() => {
  if (props.value >= 85) return 'badge-otp-good'
  if (props.value >= 60) return 'badge-otp-warning'
  return 'badge-otp-critical'
})

const dotClass = computed(() => {
  if (props.value >= 85) return 'bg-emerald-500'
  if (props.value >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
})
</script>
```

### Usándolo en cualquier página:
¡No necesitas importar nada! Simplemente escribe en cualquier `.vue`:

```vue
<template>
  <OtpBadge :value="92.4" />
</template>
```

---

## 8. Cómo Usar y Personalizar Nuxt UI

**Nuxt UI v4** proporciona una suite completa de componentes accesibles (`<UButton>`, `<UInput>`, `<USelect>`, `<UModal>`, `<UTable>`, `<UBadge>`, `<UCard>`, etc.).

### 1. Uso Estándar con Props
```vue
<template>
  <div class="space-y-4">
    <!-- Botón Primario -->
    <UButton
      color="primary"
      variant="solid"
      size="md"
      icon="i-lucide-search"
      :loading="isSearching"
      @click="onSearch"
    >
      Buscar Vuelos
    </UButton>

    <!-- Input con icono y descripción -->
    <UInput
      v-model="airportCode"
      placeholder="Código IATA (ej. MAD)"
      icon="i-lucide-plane"
      size="md"
    />

    <!-- Badge de Estado -->
    <UBadge color="success" variant="subtle">
      88% A Tiempo
    </UBadge>
  </div>
</template>
```

---

### 2. Personalización Global en `frontend/app/app.config.ts`
Puedes cambiar los colores o estilos por defecto de cualquier componente de Nuxt UI de forma centralizada:

```ts
// frontend/app/app.config.ts
export default defineAppConfig({
  ui: {
    // Paletas globales
    colors: {
      primary: 'sky',    // Aero Cyan
      neutral: 'slate',  // Dark Cockpit
    },
    // Configuración por defecto de componentes específicos
    button: {
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },
    input: {
      defaultVariants: {
        size: 'md',
      },
    },
    card: {
      slots: {
        root: 'bg-surface-base border border-border-subtle rounded-2xl backdrop-blur-xl',
      },
    },
  },
})
```

---

### 3. Personalización Individual con la Prop `:ui="{ ... }"`
Si necesitas modificar un único componente sin afectar a los demás:

```vue
<template>
  <UButton
    class="font-mono text-xs tracking-wider"
    :ui="{
      base: 'rounded-xl shadow-lg shadow-sky-500/20',
    }"
  >
    EXPANDIR TELEMETRÍA
  </UButton>
</template>
```

---

## 9. Tema Claro / Oscuro Automático (`useColorMode`)

Nuxt UI incluye soporte nativo para detección del tema del sistema operativo o navegador (`prefers-color-scheme`).

### ¿Cómo Funciona?
1. **Detección Automática:** Nuxt evalúa la preferencia del sistema. Si el SO está en modo oscuro, añade automáticamente la clase `.dark` al elemento `<html>`. Si está en claro, añade `.light`.
2. **Composable `useColorMode()`:** Permite consultar y cambiar la preferencia del usuario en tiempo real:
   - `colorMode.preference`: Puede ser `'system'` (automático por browser/SO), `'light'` (forzar claro) o `'dark'` (forzar oscuro).
   - `colorMode.value`: El tema activo actual (`'light'` o `'dark'`).

### Componente Conmutador de Tema ([`ThemeToggle.vue`](file:///home/delforr/Documents/Universidad/3er%20a%C3%B1o/Desarrollo%20de%20Software/Proyecto/frontend/app/components/common/ThemeToggle.vue)):
```vue
<template>
  <ClientOnly>
    <div class="flex items-center gap-1 bg-surface-elevated border border-border-subtle p-1 rounded-xl">
      <!-- Sistema (Automático) -->
      <button
        type="button"
        @click="colorMode.preference = 'system'"
        :class="colorMode.preference === 'system' ? 'text-aero-cyan font-bold' : 'text-text-muted'"
      >
        💻 Auto
      </button>

      <!-- Claro -->
      <button
        type="button"
        @click="colorMode.preference = 'light'"
        :class="colorMode.preference === 'light' ? 'text-amber-500 font-bold' : 'text-text-muted'"
      >
        ☀️ Claro
      </button>

      <!-- Oscuro -->
      <button
        type="button"
        @click="colorMode.preference = 'dark'"
        :class="colorMode.preference === 'dark' ? 'text-sky-400 font-bold' : 'text-text-muted'"
      >
        🌙 Oscuro
      </button>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
</script>
```

---

## 10. Consumo de Datos y APIs (`useFetch` vs `$fetch`)

Nuxt provee dos métodos principales para conectarse al backend (NestJS):

| Método | ¿Cuándo Usarlo? | Características |
| :--- | :--- | :--- |
| **`useFetch(url)`** | Carga inicial de datos de una página o componente. | Soporta SSR (no parpadea), reactivo, previene doble petición servidor/cliente, provee `data`, `pending`, `error`, `refresh`. |
| **`$fetch(url, options)`** | Acciones del usuario (clicks, formularios, mutaciones POST/PUT/DELETE). | Funciona como un `fetch` moderno estándar. |

### Ejemplo con `useFetch` (Carga Reactiva):
```vue
<script setup lang="ts">
interface Airport {
  id: string
  iata: string
  name: string
  city: string
}

// Se ejecuta en el servidor y se hidrata en el cliente sin parpadeos
const { data: airports, pending, error, refresh } = await useFetch<Airport[]>('/api/airports', {
  baseURL: 'http://localhost:3000',
  query: { limit: 10 },
})
</script>

<template>
  <div v-if="pending" class="text-text-muted font-mono">Cargando aeropuertos...</div>
  <div v-else-if="error" class="text-otp-critical">Error al cargar: {{ error.message }}</div>
  <ul v-else class="space-y-2">
    <li v-for="airport in airports" :key="airport.id" class="p-2 bg-surface-card rounded-lg border border-border-subtle">
      <span class="font-mono font-bold text-aero-cyan">{{ airport.iata }}</span> — {{ airport.name }} ({{ airport.city }})
    </li>
  </ul>
</template>
```

---

## 11. Estado Global y Composables

Para compartir estado entre múltiples componentes sin instalar librerías complejas, usa **`useState`** o crea un composable en `frontend/app/composables/`.

### Crear `frontend/app/composables/useFlightSelection.ts`:
```ts
export const useFlightSelection = () => {
  // Estado global compartido entre todos los componentes
  const selectedOrigin = useState<string>('selectedOrigin', () => 'EZE')
  const selectedDestination = useState<string>('selectedDestination', () => 'MAD')
  const activeRouteId = computed(() => `${selectedOrigin.value}-${selectedDestination.value}`)

  const swapRoute = () => {
    const temp = selectedOrigin.value
    selectedOrigin.value = selectedDestination.value
    selectedDestination.value = temp
  }

  const setRoute = (origin: string, destination: string) => {
    selectedOrigin.value = origin.toUpperCase()
    selectedDestination.value = destination.toUpperCase()
  }

  return {
    selectedOrigin,
    selectedDestination,
    activeRouteId,
    swapRoute,
    setRoute,
  }
}
```

---

## 12. Componentes Solo Cliente (`ClientOnly` para Mapas/WebGL)

Librerías que interactúan con el navegador como **`MapLibre GL`** o **`Deck.gl`** fallan si se intentan ejecutar en el servidor Node.js durante el SSR porque requieren objetos como `window`, `document` o `canvas`.

### Solución 1: Envolver con `<ClientOnly>`
```vue
<template>
  <ClientOnly>
    <FlightMapCanvas />
    <!-- Placeholder visible durante la carga o render inicial -->
    <template #fallback>
      <div class="h-96 flex items-center justify-center bg-surface-base text-text-muted font-mono">
        Iniciando motor gráfico WebGL...
      </div>
    </template>
  </ClientOnly>
</template>
```

### Solución 2: Nombrar el archivo `.client.vue`
Si nombras tu archivo `FlightMap.client.vue` dentro de `components/map/`, Nuxt automáticamente **solo lo ejecutará en el navegador** del cliente.

---

## 13. Chuleta de Comandos Frecuentes

Desde el directorio `frontend/`:

```bash
# Iniciar servidor de desarrollo con HMR (Hot Module Replacement)
npm run dev

# Regenerar tipos de TypeScript y schemas de Nuxt
npm run postinstall   # o npx nuxt prepare

# Compilar para producción (SSR + Nitro Server)
npm run build

# Previsualizar la compilación de producción localmente
npm run preview
```

---

> 💡 **Tip:** Puedes consultar y extender esta guía siempre que agregues nuevas páginas (`app/pages/`), endpoints del backend o nuevos componentes analíticos en FlyWise.
