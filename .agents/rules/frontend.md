# Reglas de Desarrollo Frontend (Nuxt 4 + Nuxt UI v4 + Tailwind CSS v4 + Deck.gl)

Estas reglas aplican a todo el código en el directorio `frontend/` y son de cumplimiento obligatorio en cualquier desarrollo o refactorización del cliente web.

---

## 1. Vue 3 & Nuxt 4 Architecture

- **Script Setup & Tipado Estricto:**
  - Utilizar exclusivamente `<script setup lang="ts">`. Prohibida la Options API.
  - Prohibido el uso de `any` injustificado y de `@ts-ignore` sin documentación técnica.
- **Composables y Lógica Reactiva:**
  - Extraer lógica de negocio, cálculos geoespaciales y llamadas API en composables bajo `app/composables/` o `features/<feature>/composables/`.
  - Para estados compartidos en SSR, utilizar siempre `useState<T>('key', () => defaultValue)`.
  - Limpiar intervalos, timers y suscripciones en el hook `onUnmounted()` para prevenir fugas de memoria.

---

## 2. Nuxt UI v4 First (`@nuxt/ui`)

- **Prioridad de Primitivas:**
  - **PROHIBIDO** construir componentes HTML/CSS a mano cuando existan primitivas listas en `@nuxt/ui: ^4.11.0`:
    - Modales y diálogos: `<UModal>` (evitar `<Teleport>` manual).
    - Tarjetas estructuradas: `<UCard>`.
    - Estados vacíos: `<UEmpty>`.
    - Indicadores y tags: `<UBadge>` (con colores semánticos `success`, `warning`, `error`, `info`, `neutral`).
    - Barras de progreso: `<UProgress>`.
    - Paneles colapsables: `<UCollapsible>`.
    - Formularios e inputs: `<UInput>`, `<USelect>`, `<URadioGroup>`, `<UCheckbox>`, `<UButton>`, `<UAuthForm>`.
    - Notificaciones contextuales: composable nativo `useToast()`.
- **Iconografía Unificada:**
  - Usar `<UIcon name="i-lucide-<nombre>" />` con colección Lucide preinstalada (`@iconify-json/lucide`).

---

## 3. Deck.gl & MapLibre (WebGL Performance — RNF-02)

- **Aislamiento de Renderizado en Servidor (SSR):**
  - **NUNCA** inicializar contextos de WebGL, instancias de MapLibre o Deck.gl durante la fase de SSR en Nuxt (causa errores críticos de `window` o `HTMLCanvasElement` no definido).
  - Encapsular todas las capas interactivas dentro de componentes `<ClientOnly>` o instanciarlas estrictamente dentro del hook `onMounted()`.
- **Rendimiento a 60 FPS:**
  - Mantener un objetivo de 60 FPS en paneo, rotación y zoom.
  - Evitar recrear instancias de capas en cada tick de renderizado; actualizar únicamente las fuentes de datos (`data`) para aprovechar el algoritmo de diffing reactivo de Deck.gl.
- **Visualización de Puntualidad OTP-15:**
  - Los arcos geodésicos de vuelos deben renderizarse mediante `ArcLayer` codificados por color según la métrica OTP-15:
    - **Verde:** OTP-15 $> 85\%$ (Alta puntualidad).
    - **Amarillo:** OTP-15 entre $60\%$ y $85\%$ (Puntualidad moderada).
    - **Rojo:** OTP-15 $< 60\%$ (Baja puntualidad / alta demora).

---

## 4. Integridad de Tailwind CSS v4

- **PROHIBIDO SIN EXCEPCIÓN** crear o editar archivos `tailwind.config.js` ni `tailwind.config.ts`.
- Toda personalización de diseño, tokens, fuentes y colores debe residir en los archivos CSS de la aplicación (`app/app.css`, `app/assets/css/`) utilizando directivas `@import "tailwindcss"` y bloques `@theme`.

---

## 5. Quality Gate Frontend (Definición de Terminado)

Antes de dar por completado cualquier cambio en el frontend:
1. `npm --prefix frontend run build` finaliza con código de salida `0` (sin errores de compilación ni fallos en Nitro server / Vite).
2. Si existen tests en `frontend/`, ejecutarlos mediante `npm --prefix frontend test` verificando que pasen al 100%.
3. Verificar que la consola del navegador permanezca limpia de advertencias o errores de hidratación.
