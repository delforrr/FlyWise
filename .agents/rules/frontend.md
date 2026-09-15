# Reglas de Desarrollo Frontend (Nuxt + Tailwind CSS + Deck.gl + MapLibre)

Estas reglas aplican a todo el código en el directorio `frontend/`.

---

## 1. Vue 3 & Nuxt

- **Script Setup:** Utilizar exclusivamente `<script setup lang="ts">`. Prohibida la Options API.
- **Lógica Reactiva:** Extraer la lógica de negocio y consumo de API en composables limpios en `app/composables/` (`useMap`, `useRoutes`, `useAirports`).
- **SEO & Performance:** Utilizar SSR/SSG adecuadamente, pero renderizar las capas de Deck.gl y MapLibre en componentes con `<ClientOnly>` o condicionales de montaje en cliente para evitar fallos de renderizado del lado del servidor (SSR WebGL context).

---

## 2. Estilos & Tailwind CSS

- **Utility-First:** Utilizar clases de Tailwind CSS para la interfaz, layouts y componentes UI.
- **Accesibilidad y Contraste:** Asegurar que los componentes de búsqueda, paneles de administración y tablas de puntualidad tengan contrastes legibles sobre el mapa.
- **Diseño Responsivo:** Diseñar con mobile-first en mente, garantizando que el mapa y los filtros colapsen limpiamente en pantallas pequeñas.

---

## 3. Deck.gl & MapLibre (WebGL Performance)

- **60 FPS Goal:** El mapa y la interacción con arcos geodésicos deben mantener fluidez constante.
- **Capas Optimizadas:**
  - Los arcos de rutas deben renderizarse con `ArcLayer` codificados según OTP-15 (Verde $> 85\%$, Amarillo $60\%-85\%$, Rojo $< 60\%$).
  - Nodos de aeropuertos con `ScatterplotLayer` o `IconLayer` con `pickable: true` para tooltips informativos.
  - Evitar recrear instancias de layers en cada render; actualizar únicamente las propiedades de datos (`data`) para aprovechar el diffing reactivo de Deck.gl.
- **Context Loss:** Manejar la pérdida de contexto WebGL con reconexión suave o fallback visual.
