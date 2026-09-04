# 🗺️ FlyWise Frontend Development Roadmap

> **Sistema de Inteligencia de Vuelos Comerciales y Exploración de Rutas**  
> **Stack:** Nuxt 4 (Vue 3, TypeScript) + Nuxt UI v4 + Tailwind CSS + MapLibre GL JS + Deck.gl (WebGL)

---

## 🎯 Objetivos de la Interfaz

1. **Visualización Geoespacial 60 FPS:** Renderizado en GPU de miles de rutas aéreas (arcos geodésicos coloreados por OTP-15) y aeropuertos globales.
2. **Búsqueda & Comparativa Intuitiva:** Autocompletado ágil de aeropuertos, filtros dinámicos y comparador de aerolíneas por puntualidad histórica.
3. **Dashboards Analíticos & Operativos:** Visualización de métricas de retrasos y panel de control administrativo para orquestación de pipelines ETL (BullMQ).
4. **Resiliencia & Performance:** Manejo seguro de renderizado del lado del cliente (ClientOnly para WebGL), SSR para SEO en vistas públicas y responsive design total.

---

## 🧭 Fases del Roadmap

```mermaid
flowchart LR
    F0["Fase 0<br>Setup & Core"] --> F1["Fase 1<br>Mapa & WebGL"]
    F1 --> F2["Fase 2<br>Búsqueda & Rutas"]
    F2 --> F3["Fase 3<br>Analítica & OTP-15"]
    F3 --> F4["Fase 4<br>Auth & Admin ETL"]
    F4 --> F5["Fase 5<br>Polishing & QA"]
```

---

### 📦 Fase 0: Setup, Arquitectura Base y Dependencias
*Objetivo: Establecer la base estructural, tipado y dependencias gráficas/UI.*

- [ ] **0.1 Instalación de dependencias clave:**
  - `maplibre-gl` y sus tipos `@types/maplibre-gl`.
  - `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox`.
  - Herramientas de visualización de datos: `chart.js` + `vue-chartjs` (o `unovis` / `@unovis/vue`).
  - Utilidades: `@vueuse/core`, `date-fns` o `dayjs`.
- [ ] **0.2 Configuración de Nuxt & Tailwind:**
  - Configurar `nuxt.config.ts` (transpilación de paquetes deck.gl/maplibre si es necesario, variables de entorno públicas `NUXT_PUBLIC_API_BASE_URL`).
  - Configurar variables de diseño en Tailwind (paleta semántica: OTP verde `#10B981`, amarillo `#F59E0B`, rojo `#EF4444`).
- [ ] **0.3 Arquitectura de Directorios:**
  ```text
  frontend/app/
  ├── assets/          # Estilos globales, iconos SVG
  ├── components/
  │   ├── admin/       # Componentes del dashboard ETL
  │   ├── analytics/   # Gráficos de puntualidad y demoras
  │   ├── common/      # Modales, botones, badges reutilizables
  │   ├── layout/      # Navbar, Sidebar, Footer
  │   ├── map/         # Canvas WebGL, DeckGLOverlay, MapControls
  │   └── search/      # Autocomplete, DatePicker, RouteFilters
  ├── composables/     # useMap, useAirports, useRoutes, useETL, useAuth
  ├── layouts/         # default.vue, admin.vue, fullscreen-map.vue
  ├── middleware/      # auth.ts (protección de /admin)
  ├── pages/
  │   ├── index.vue            # Vista principal: Mapa interactivo + Búsqueda
  │   ├── routes/[id].vue      # Detalle profundo de una ruta específica
  │   ├── login.vue            # Inicio de sesión administrativo
  │   └── admin/
  │       ├── index.vue        # Dashboard general
  │       └── etl.vue          # Monitoreo BullMQ y triggers
  ├── stores/ or state/ # Estado reactivo global (Pinia o useState)
  └── types/           # Interfaces TypeScript (Airport, Route, Metric, Job)
  ```
- [ ] **0.4 Definición de Tipos Core (`types/`):**
  - `Airport`: `id, iata, icao, name, city, country, latitude, longitude`.
  - `RoutePerformance`: `origin, destination, airline, otp15, avgDelayMinutes, cancellationRate, period`.
  - `ETLJob`: `id, name, status, progress, logs, failedRows, createdAt`.

---

### 🗺️ Fase 1: Capa de Visualización Geoespacial (WebGL & MapLibre)
*Objetivo: Integrar el mapa base y la capa de WebGL con aceleración por GPU sin problemas de hidratación SSR.*

- [ ] **1.1 Componente Base del Mapa (`components/map/FlightMap.client.vue`):**
  - Instanciar MapLibre GL con estilo oscuro/claro (ej. Carto Positron / Dark Matter o OSM).
  - Encapsular la lógica en `useMapLibre()` para control de cámara (zoom, pitch, bearing, bounds).
- [ ] **1.2 Integración con Deck.gl (`useDeckOverlay`):**
  - Crear el overlay de Deck.gl sincronizado con la cámara de MapLibre GL.
  - Implementar **`ScatterplotLayer` / `IconLayer`** para renderizar aeropuertos con clustering dinámico por nivel de zoom.
  - Implementar **`ArcLayer`** para trazar arcos geodésicos entre orígenes y destinos.
- [ ] **1.3 Semántica de Color por OTP-15:**
  - Función de escala cromática WebGL:
    - 🟢 OTP-15 $> 85\% \rightarrow [16, 185, 129, 200]$
    - 🟡 $60\% \le \text{OTP-15} \le 85\% \rightarrow [245, 158, 11, 200]$
    - 🔴 OTP-15 $< 60\% \rightarrow [239, 68, 68, 200]$
- [ ] **1.4 Interactividad y Picking:**
  - Hover de rutas y aeropuertos con resaltado de arco (`highlightColor`).
  - Tooltip flotante interactivo (`components/map/MapTooltip.vue`) mostrando IATA origen-destino, aerolínea y % de puntualidad.
  - Click en aeropuerto para centrar cámara y filtrar rutas salientes/entrantes.

---

### 🔍 Fase 2: Motor de Búsqueda, Filtros y UI de Exploración
*Objetivo: Proporcionar controles de navegación rápidos para consultar rutas y comparar opciones.*

- [ ] **2.1 Buscador Flotante de Vuelos (`components/search/FlightSearchBar.vue`):**
  - Inputs con autocompletado y debounce para Aeropuerto Origen y Destino (búsqueda por IATA, ciudad o nombre).
  - Selector de rango de fechas / período histórico (mes/año).
  - Botón de inversión de ruta (⇄ Origen/Destino).
- [ ] **2.2 Composables de Datos (`composables/useRoutes.ts`, `composables/useAirports.ts`):**
  - Conexión con endpoints del backend: `GET /api/airports`, `GET /api/routes/search`.
  - Manejo de estados: `pending`, `error`, `data`, con skeleton loaders en la interfaz.
- [ ] **2.3 Drawer / Panel Lateral de Resultados (`components/search/RouteResultsDrawer.vue`):**
  - Lista de aerolíneas que operan el tramo seleccionado.
  - Ordenamiento rápido por: Mayor Puntualidad (OTP-15), Menor Demora Promedio, Mayor Frecuencia.
  - Tarjetas comparativas con insignias visuales (ej. *Badge: 92% a tiempo*).

---

### 📊 Fase 3: Analítica Detallada de Puntualidad (OTP-15)
*Objetivo: Mostrar la analítica profunda por ruta, aerolínea y estacionalidad.*

- [ ] **3.1 Vista de Detalle de Ruta (`pages/routes/[id].vue` o Modal de Métricas):**
  - Desglose estadístico:
    - Total de vuelos evaluados.
    - Demora promedio en minutos.
    - Tasa de cancelaciones y desvíos.
- [ ] **3.2 Gráficos Analíticos (`components/analytics/`):**
  - `OtpTrendChart.vue`: Gráfico de línea histórica mensual (Evolución de OTP-15 en los últimos 12 meses).
  - `DelayDistributionChart.vue`: Gráfico de barras de distribución de retrasos (<15 min, 15-45 min, >45 min).
  - `AirlineComparisonRadar.vue` o Barras horizontales comparando aerolíneas en la misma ruta.
- [ ] **3.3 Exportación & Compartir:**
  - Botón para exportar resumen a CSV / captura rápida o link permanente a la ruta (`/routes/EZE-MAD`).

---

### 🔐 Fase 4: Autenticación y Panel de Administración ETL
*Objetivo: Proveer acceso seguro a administradores para monitorear y disparar procesos de ingesta de datos aeronáuticos.*

- [ ] **4.1 Autenticación (`pages/login.vue`, `composables/useAuth.ts`):**
  - Formulario de inicio de sesión con validación Nuxt UI.
  - Almacenamiento seguro del JWT (cookies httpOnly o estado reactivo con persistencia segura).
  - Middleware de ruta (`middleware/auth.ts`) para proteger rutas `/admin/**`.
- [ ] **4.2 Dashboard de Monitoreo ETL (`pages/admin/etl.vue`):**
  - Indicadores clave (KPIs): Total de vuelos procesados, jobs activos en BullMQ, tasa de éxito/error.
  - Tabla en tiempo real de colas de ingesta:
    - Fuentes: OurAirports, OpenFlights, ANAC, BTS TranStats.
    - Estados: `Waiting`, `Active`, `Completed`, `Failed`.
    - Barra de progreso del pipeline.
- [ ] **4.3 Control de Operaciones ETL:**
  - Botón para disparar ingesta manual bajo demanda.
  - Visor de logs y anomalías (modal con registros de excepciones y filas descartadas por incoherencias geoespaciales).

---

### 🚀 Fase 5: Optimización, Accesibilidad y Testing
*Objetivo: Asegurar fluidez a 60 FPS, diseño adaptativo móvil y calidad de código.*

- [ ] **5.1 Rendimiento & WebGL Optimization:**
  - Render throttling y lazy loading de capas geoespaciales no visibles.
  - Cache de aeropuertos y rutas frecuentes en cliente (IndexedDB o sessionStorage con `useStorage`).
- [ ] **5.2 Responsive & Mobile Experience:**
  - Adaptación del mapa a dispositivos móviles (bottom-sheet drawer retráctil para búsquedas).
  - Gestos táctiles optimizados (pinch-to-zoom, rotación con dos dedos).
- [ ] **5.3 Testing & Calidad:**
  - Tests unitarios y de componentes con **Vitest** y `@vue/test-utils`.
  - Tests E2E de flujos críticos con **Playwright** (Búsqueda de ruta -> visualización en mapa -> apertura de métricas).
  - Auditoría Lighthouse: Accesibilidad (a11y), Contraste de colores y Best Practices.

---

## 🛠️ Prioridad de Tareas Recomendada (Primeros Pasos)

| Prioridad | Tarea | Dependencias clave | Entregable inmediato |
| :--- | :--- | :--- | :--- |
| **P0** | Instalar `maplibre-gl` y `@deck.gl/*` | `package.json` | Paquetes instalados y configurados sin conflicto SSR |
| **P0** | Crear layout principal con contenedor de mapa a pantalla completa | `app.vue`, `layouts/default.vue` | Canvas de mapa renderizando globo/mapa base |
| **P1** | Implementar `FlightMap.client.vue` con Deck.gl ArcLayer de prueba | MapLibre + Deck.gl | Arcos de prueba EZE $\rightarrow$ MAD / JFK con colores OTP |
| **P1** | Crear `FlightSearchBar.vue` flotante sobre el mapa | Nuxt UI (`UInput`, `USelectMenu`) | Barra de búsqueda reactiva con aeropuertos mock/API |
| **P2** | Conectar con endpoints backend (`/api/airports`, `/api/routes`) | `$fetch`, composables | Búsqueda real de rutas con datos de PostgreSQL/PostGIS |
