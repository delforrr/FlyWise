# FlyWise - Contexto del Proyecto y Stack Tecnológico

> **Sistema de Inteligencia de Vuelos Comerciales y Exploración de Rutas**  
> *Materia:* Desarrollo de Software — Año 2026 (2do Cuatrimestre)  
> *Autor:* Delfor Vicondo Grosso  
> *Profesor:* Luciano De La Lama  

---

## 1. Visión General del Proyecto

**FlyWise** es una plataforma orientada al análisis de confiabilidad de vuelos comerciales y la visualización interactiva de redes globales de rutas aéreas. El sistema permite a los viajeros consultar la puntualidad histórica y métricas de desempeño de las aerolíneas mediante un mapa interactivo acelerado por GPU, y a los administradores orquestar pipelines ETL masivos para la ingesta y agregación de datos abiertos aeronáuticos.

### Objetivos Principales
- **Transparencia Operativa:** Proveer a los usuarios finales información clara y verídica sobre la puntualidad (**OTP-15**), cancelaciones y demoras promedio por ruta y aerolínea.
- **Visualización Geoespacial de Alto Rendimiento:** Renderizar miles de arcos geodésicos en un mapa global con codificación de colores según el desempeño histórico.
- **Orquestación ETL Asíncrona:** Descargar, normalizar y agregar grandes volúmenes de datos abiertos de aviación de forma automatizada y resiliente sin degradar la experiencia de usuario.

---

## 2. Dominio y Conceptos Clave

- **OTP-15 (*On-Time Performance*):** Métrica estándar que califica un vuelo como puntual si arriba con un retraso $\le 15$ minutos respecto a su itinerario programado.
- **Codificación Visual de Rutas:**
  - 🟢 **Verde:** OTP-15 $> 85\%$ (Alta puntualidad).
  - 🟡 **Amarillo:** OTP-15 entre $60\%$ y $85\%$ (Puntualidad moderada).
  - 🔴 **Rojo:** OTP-15 $< 60\%$ (Baja puntualidad / alta probabilidad de demoras).
- **Tupla de Agregación Analítica:** `(Aeropuerto Origen, Aeropuerto Destino, Aerolínea, Mes/Año)`.
- **Fuentes de Datos Abiertas:**
  - *Aeropuertos:* OurAirports (coordenadas geográficas, códigos IATA/ICAO, elevación, país).
  - *Rutas y Conexiones:* OpenFlights (pares origen-destino, aerolíneas operadoras).
  - *Telemetría y Desempeño Operativo:* ANAC (Argentina / Brasil), BTS TranStats (EE.UU.), Eurocontrol, OpenSky Network.

---

## 3. Stack Tecnológico y Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Nuxt 3)                        │
│   Vue 3 + TypeScript + MapLibre GL JS + Deck.gl (WebGL)     │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP / REST
┌──────────────────────────────▼──────────────────────────────┐
│                    Backend (NestJS)                         │
│   TypeScript + Prisma ORM + Passport JWT + Cache Manager    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│ PostgreSQL 16 + PostGIS     │ │       Redis 7 + BullMQ      │
│ (Datos geoespaciales,       │ │ (Colas ETL asíncronas,      │
│  aeropuertos, vuelos, auth) │ │  cache-warming, rate-limit) │
└─────────────────────────────┘ └─────────────────────────────┘
```

### 3.1 Frontend
- **Framework:** [Nuxt 3](https://nuxt.com/) (Vue 3, Vite, TypeScript, PWA).
- **Cartografía & Visualización Geoespacial:**
  - **MapLibre GL JS:** Control de cámara, teselas vectoriales/raster, zoom y rotación.
  - **Deck.gl (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`):** Renderizado acelerado por hardware (WebGL) para arcos geodésicos (`ArcLayer`) y nodos de aeropuertos (`ScatterplotLayer` / `IconLayer`).
- **Map Tiles:** Carto / OpenStreetMap mediante HTTPS.

### 3.2 Backend
- **Framework:** [NestJS](https://nestjs.com/) (Node.js con TypeScript, arquitectura modular basada en módulos, controladores, servicios y repositorios).
- **ORM / Capa de Datos:** [Prisma ORM](https://www.prisma.io/) interactuando con PostgreSQL.
- **Autenticación & Seguridad:** Passport.js + `@nestjs/passport` + `passport-jwt` + `bcrypt` (Autenticación JWT con roles diferenciados).
- **Validación & Transformación:** `class-validator` y `class-transformer`.
- **Parsing de Datasets:** `csv-parser` y `axios` para ingesta por streaming.

### 3.3 Base de Datos y Servicios de Infraestructura
- **Base de Datos Relacional y Espacial:** PostgreSQL 16 con extensión **PostGIS** (para consultas de proximidad espacial, cálculo de distancias ortodrómicas y soporte de tipos geográficos).
- **Procesamiento en Segundo Plano & Caching:**
  - **Redis 7 (Alpine):** Almacén clave-valor en memoria.
  - **BullMQ (`@nestjs/bullmq`):** Orquestación y gestión de colas de trabajos asíncronos para pipelines ETL (descarga, parseo, normalización, cálculo de métricas y *cache-warming*).
- **Entorno de Contenedores:** Docker Compose (`flywise_postgres`, `flywise_redis`).

---

## 4. Requisitos del Sistema (SRS Mapping)

### 4.1 Requisitos Funcionales (RF)
- **RF-01 (Mapa de Rutas Interactivo):** Visualización global de conexiones activas mediante arcos geodésicos Deck.gl coloreados según OTP-15.
- **RF-02 (Búsqueda y Comparativa por Tramo):** Consulta directa indicando origen, destino y fecha; listado de aerolíneas ordenadas descendentemente por puntualidad histórica.
- **RF-03 (Métricas Analíticas):** Computación periódica de OTP-15, tasa de cancelaciones y demora media por tupla `(Origen, Destino, Aerolínea, Periodo)`.
- **RF-04 (Pipelines ETL):** Ingesta manual (disparada por el administrador) y programada (cron jobs semanales/mensuales).
- **RF-05 (Monitoreo de Ingesta en Panel Admin):** Dashboard en tiempo real del estado de jobs (espera, activos, completados, fallidos), métricas de volumen, logs de excepciones y filas descartadas.
- **RF-06 (Autenticación y Autorización):** Control de acceso administrativo protegido por JWT y encriptación de credenciales.

### 4.2 Requisitos No Funcionales (RNF)
- **RNF-01 (Latencia):** Respuestas de API $\le 150\text{ ms}$ para consultas de rutas y métricas agregadas.
- **RNF-02 (Rendimiento Gráfico):** Interacción fluida en el cliente (60 FPS en paneo y zoom) mediante capas WebGL de Deck.gl.
- **RNF-03 (Seguridad):** Cifrado en tránsito (HTTPS/TLS) y en reposo para credenciales (`bcrypt`).
- **RNF-04 (Tolerancia a Fallos y Procesamiento Asíncrono):** Ejecución no bloqueante de procesos pesados mediante BullMQ, garantizando alta disponibilidad del backend.

---

## 5. Estructura del Repositorio

```text
.
├── .agents/
│   └── srs.md                 # Documento formal SRS de Requisitos de Software
├── backend/                   # API NestJS
│   ├── prisma/
│   │   └── schema.prisma      # Esquema de base de datos relacional
│   ├── src/
│   │   ├── auth/              # Módulo de autenticación y guardias JWT
│   │   ├── airports/          # Módulo de consulta geoespacial de aeropuertos
│   │   ├── routes/            # Módulo de rutas y cálculo OTP-15
│   │   ├── etl/               # Pipelines de ingesta, procesadores BullMQ
│   │   ├── metrics/           # Agregación analítica de puntualidad
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # Aplicación Nuxt 3
│   ├── app/
│   │   ├── app.vue
│   │   ├── components/        # Componentes Vue (Map, SearchBar, AdminDashboard)
│   │   ├── composables/       # Lógica reactiva (useMap, useRoutes, useAuth)
│   │   └── pages/             # Vistas de usuario y panel admin
│   ├── nuxt.config.ts
│   └── package.json
├── docker-compose.yml         # Servicios PostgreSQL + PostGIS y Redis
├── gemini.md                  # Contexto y directrices para asistentes de IA
└── README.md
```

---

## 6. Directrices de Desarrollo para Agentes y Desarrolladores

1. **Modelado y Consultas Espaciales:**
   - Asegurar que las coordenadas de aeropuertos se indexen adecuadamente (`SRID 4326`).
   - Las consultas de agregación analítica deben estar optimizadas con índices compuestos en `(originId, destinationId, airlineId, period)`.
2. **Pipelines ETL Seguros:**
   - Todo parseo de archivos masivos debe realizarse mediante *streams* o procesamiento por lotes (*batches*) en *workers* de BullMQ para evitar fugas de memoria (`OutOfMemoryError`).
   - Guardar registro de auditoría de cada ejecución con logs de filas erróneas o descartadas.
3. **Estrategia de Caché (*Cache-Warming*):**
   - Precalcular y almacenar en Redis las rutas más consultadas y las estadísticas agregadas globales tras completar cada pipeline ETL.
4. **Tipado Estricto:**
   - Mantener TypeScript estricto tanto en backend (NestJS DTOs con `class-validator`) como en frontend (Nuxt interfaces).
