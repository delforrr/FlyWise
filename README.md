# FlyWise: Sistema de Inteligencia de Vuelos Comerciales y Exploración de Rutas

## 1. Descripción General

FlyWise es una plataforma orientada al análisis de confiabilidad operativa en la aviación comercial y a la visualización interactiva de redes globales de transporte aéreo.

El sistema proporciona a los usuarios finales información sobre la puntualidad histórica de vuelos mediante el estándar internacional OTP-15, desglosada por tramo y aerolínea, a través de un mapa interactivo. Asimismo, incluye un módulo de administración para la orquestación, ingestión y supervisión de pipelines ETL asíncronos sobre conjuntos de datos abiertos del sector aeronáutico.

### Objetivos del Sistema

- Proveer análisis cuantitativo de la puntualidad histórica, cancelaciones y demoras promedio por par de conexión y operador aéreo.
- Renderizar redes geoespaciales a escala global con codificación visual por desempeño operativo mediante capas aceleradas por GPU a 60 FPS.
- Ejecutar procesos de extracción, transformación y carga (ETL) de conjuntos de datos masivos de forma asíncrona y no bloqueante mediante arquitectura de colas distribuidas.

## 2. Dominio y Métricas Aeronáuticas

### Estándar OTP-15 (On-Time Performance)

El estándar de la industria aeronáutica califica un vuelo como puntual (On-Time) si su arribo efectivo se registra con un retraso menor o igual a 15 minutos respecto a la hora programada en el itinerario oficial.

La métrica se expresa mediante la siguiente relación:

```text
OTP-15 (%) = (Arribos con demora <= 15 minutos / Total de vuelos operados) * 100
```

### Codificación Semántica de Rutas

La representación visual de los arcos de vuelo refleja el desempeño histórico del tramo:

- Verde (Puntualidad Alta): OTP-15 superior al 85%.
- Amarillo (Puntualidad Moderada): OTP-15 entre el 60% y el 85%.
- Rojo (Puntualidad Deficiente / Alta Demora): OTP-15 inferior al 60%.

### Modelo Analítico y Clave de Agregación

Las consultas analíticas de rendimiento operan sobre la tupla:

```text
(Aeropuerto Origen, Aeropuerto Destino, Aerolínea Operadora, Periodo Temporal)
```

En la capa de persistencia, esta clave se encuentra respaldada por índices compuestos en PostgreSQL para evitar escaneos secuenciales sobre tablas de telemetría de gran escala.

### Fuentes de Datos Abiertas

- OurAirports: Catálogo geoespacial de aeropuertos, códigos IATA e ICAO, coordenadas geográficas bajo estándar WGS 84 (SRID 4326), elevación y país.
- OpenFlights: Mapeo de rutas globales, pares de conexión y aerolíneas activas.
- BTS TranStats (Bureau of Transportation Statistics) y ANAC: Registros operativos de vuelos, causas de demoras y métricas de cancelación.

## 3. Arquitectura del Sistema

```text
+-------------------------------------------------------------+
|                      Frontend (Nuxt 4)                      |
|       Vue 3 + TypeScript + MapLibre GL JS + Deck.gl         |
|             Nuxt UI v4 + Tailwind CSS v4 (HUD)              |
+------------------------------+------------------------------+
                               | HTTP / REST (JSON)
+------------------------------v------------------------------+
|                      Backend (NestJS 11)                    |
|    TypeScript + Prisma ORM + Passport JWT + Class-Validator |
+---------------+------------------------------+--------------+
                |                              |
+---------------v-------------+ +--------------v--------------+
|   PostgreSQL 16 + PostGIS   | |       Redis 7 + BullMQ      |
|  (Persistencia relacional,  | |  (Colas asíncronas ETL,     |
|   cálculo espacial SRID 4326)| |   control de concurrencia,  |
|                             | |   caché de agregaciones)    |
+-----------------------------+ +-----------------------------+
```

### Componentes Tecnológicos

- Frontend:
  - Framework: Nuxt 4 (Vue 3, Vite, TypeScript) con renderizado híbrido y aislamiento estricto de SSR para componentes WebGL.
  - Cartografía y Visualización Espacial: MapLibre GL JS para control de cámara y teselas cartográficas, integrado con Deck.gl v9 (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`) para renderizado acelerado por hardware de arcos geodésicos (`ArcLayer`) y nodos de aeropuertos (`ScatterplotLayer`).
  - Interfaz de Usuario: Nuxt UI v4 (`@nuxt/ui`), iconografía Lucide (`@iconify-json/lucide`) y Tailwind CSS v4 estructurado mediante directivas `@theme` sin archivos de configuración JavaScript intermedios.
- Backend:
  - Framework: NestJS 11 con arquitectura modular y principios de inyección de dependencias.
  - Validación y Seguridad: `ValidationPipe` global con sanitización forzada (`whitelist`, `forbidNonWhitelisted`), encriptación de credenciales con `bcrypt` y protección de rutas mediante JSON Web Tokens (`passport-jwt`).
  - Capa de Datos: Prisma ORM sobre PostgreSQL 16 con extensión PostGIS para indexación espacial y cálculo de distancias ortodrómicas (`ST_DistanceSphere`, `ST_DWithin`).
  - Procesamiento Asíncrono: Redis 7 y BullMQ (`@nestjs/bullmq`) para ingestión por lotes (batches de 1.000 a 5.000 filas) y procesamiento reactivo mediante streams de Node.js (`csv-parser`).

## 4. Módulos y Funcionalidades del Sistema

### 4.1 Explorador Cartográfico y HUD de Vuelo (Frontend)

- Visualizador de Red Global: Renderizado interactivo de rutas comerciales mediante arcos geodésicos coloreados según el indicador OTP-15.
- HUD Táctico (Cockpit Controls): Instrumental de navegación que incluye brújula dinámica, indicador de inclinación (pitch calibrado a 36 grados para perspectiva tridimensional) y retículo táctico de telemetría.
- Panel de Comando Global (Command Palette): Acceso mediante la combinación de teclas `Cmd+K` o `Ctrl+K` para búsqueda rápida de aeropuertos, rutas directas y ejecución de atajos del sistema.
- Atajos de Teclado Aeronáuticos: Controles rápidos para centrado cardinal norte, alternancia de vista tridimensional, apertura de búsqueda y despliegue del manual de atajos.
- Tooltips Dinámicos: Inspección en tiempo real de arcos y nodos aeroportuarios con cálculo instantáneo de distancias ortodrómicas en kilómetros y millas náuticas, junto con coordenadas geográficas en formato SRID 4326.

### 4.2 Auditoría y Comparativa de Rutas

- Desglose por Operador: Detalle comparativo de aerolíneas que operan el tramo seleccionado, ordenadas por puntualidad histórica, demoras promedio y tasa de cancelación.
- Tendencias Temporales (Sparklines): Gráficos vectoriales SVG compactos que muestran la evolución mensual del índice OTP-15 en los periodos históricos registrados.
- Conexiones y Alternativas con Escala: Identificación de itinerarios alternativos con escalas intermedias ante la ausencia de servicios directos o indicadores deficientes en el tramo principal.

### 4.3 Centro de Ingesta y Monitoreo ETL (Panel de Administración)

- Supervisión de Pipelines: Monitoreo del estado de sincronización de cada fuente de datos configurada (OurAirports, OpenFlights, BTS TranStats, ANAC).
- Registro de Auditoría en Tiempo Real: Consola de eventos con métricas de lotes procesados, tiempos de ejecución y registro de excepciones.
- Gestión de Descarte de Registros: Inspección de muestras de datos inconsistentes descartadas durante la ingestión y herramientas de reintento selectivo.
- Controles de Flujo: Disparo manual de sincronizaciones, pausa de colas y reintento de tareas fallidas.

## 5. Estructura del Repositorio

```text
.
├── backend/                   # API REST y servicios de dominio en NestJS
│   ├── prisma/
│   │   └── schema.prisma      # Esquema de base de datos relacional y PostGIS
│   ├── src/
│   │   ├── airports/          # Módulo de catálogo aeroportuario y consultas espaciales
│   │   ├── routes/            # Módulo de tramos, cálculo de arcos y OTP-15
│   │   ├── etl/               # Procesadores BullMQ y transformación de datasets
│   │   ├── metrics/           # Agregación analítica de puntualidad
│   │   ├── auth/              # Control de acceso y autenticación JWT
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # Aplicación web en Nuxt 4
│   ├── app/
│   │   ├── assets/            # Hojas de estilo y tokens de diseño Tailwind v4
│   │   ├── features/
│   │   │   ├── auth/          # Autenticación y formulario de acceso administrativo
│   │   │   ├── flight-map/    # Canvas WebGL (MapLibre + Deck.gl), HUD y atajos
│   │   │   ├── route-audit/   # Paneles de auditoría, sparklines y comparativas
│   │   │   └── etl-monitoring/# Panel de administración y supervisión de colas
│   │   ├── layouts/           # Plantillas de diseño (hero-split, admin)
│   │   ├── pages/             # Rutas de la aplicación (/, /explorar, /admin, /login)
│   │   ├── shared/            # Componentes reutilizables, modales y utilidades
│   │   ├── types/             # Definiciones de tipos TypeScript de dominio
│   │   └── app.vue
│   ├── nuxt.config.ts
│   └── package.json
├── docker-compose.yml         # Configuración de contenedores PostgreSQL (PostGIS) y Redis
├── AGENTS.md                  # Guardrails técnicos, gobernanza Git y Quality Gate
├── GEMINI.md                  # Contexto arquitectónico del sistema
└── README.md                  # Documentación principal del repositorio
```

## 6. Requisitos de Infraestructura

Para ejecutar el entorno local se requiere disponer de:

- Node.js versión 20.x o 22.x LTS.
- Docker y Docker Compose.
- Gestor de paquetes npm versión 10.x o superior.

## 7. Instalación y Puesta en Marcha

### 7.1 Servicios de Base de Datos y Caché

Iniciar los contenedores de PostgreSQL (con soporte PostGIS) y Redis definidos en Docker Compose:

```bash
docker compose up -d
```

Los servicios quedarán operativos en los siguientes puertos:

- PostgreSQL (PostGIS): `localhost:5432`
- Redis: `localhost:6379`

### 7.2 Configuración y Ejecución del Backend

1. Acceder al directorio del backend:

```bash
cd backend
```

1. Instalar dependencias del proyecto:

```bash
npm install
```

1. Crear el archivo de variables de entorno `.env` en la raíz de `backend/`:

```env
DATABASE_URL="postgresql://dev_user:dev_password@localhost:5432/flywise_db?schema=public"
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=clave_secreta_jwt_de_desarrollo
```

1. Generar el cliente de Prisma y ejecutar las migraciones:

```bash
npx prisma generate
npx prisma migrate dev
```

1. Iniciar el servidor de desarrollo:

```bash
npm run start:dev
```

La API estará disponible en `http://localhost:3001/api`.

### 7.3 Configuración y Ejecución del Frontend

1. Acceder al directorio del frontend en una nueva terminal:

```bash
cd frontend
```

1. Instalar dependencias del cliente:

```bash
npm install
```

1. Iniciar el servidor de desarrollo de Nuxt:

```bash
npm run dev
```

La aplicación web estará disponible en `http://localhost:3000`.

## 8. Variables de Entorno

### Backend (`backend/.env`)

| Variable       | Descripción                                              | Valor de Ejemplo                                                             |
| -------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL con soporte PostGIS      | `postgresql://dev_user:dev_password@localhost:5432/flywise_db?schema=public` |
| `PORT`         | Puerto de escucha de la API NestJS                       | `3001`                                                                       |
| `REDIS_HOST`   | Host del servidor Redis para colas BullMQ y caché        | `localhost`                                                                  |
| `REDIS_PORT`   | Puerto de red del servidor Redis                         | `6379`                                                                       |
| `JWT_SECRET`   | Clave secreta para la firma y verificación de tokens JWT | Cadena alfanumérica segura                                                   |

## 9. Políticas de Calidad y Desarrollo (Quality Gate)

El desarrollo en este repositorio se rige por las directrices documentadas en [AGENTS.md](AGENTS.md):

1. Compilación Estricta de TypeScript:
   - Backend: `npm --prefix backend run build` con código de salida `0`.
   - Frontend: `npm --prefix frontend run build` con código de salida `0` sin advertencias de tipos no controlados ni fallos en Nitro.
2. Pruebas Automatizadas:
   - Ejecución de la suite de pruebas mediante `npm test` en ambos proyectos con el 100% de los casos en estado verde.
3. Gestión de Memoria en Procesamiento Masivo (RNF-04):
   - Prohibido el uso de `fs.readFileSync` en la lectura de archivos de datos extensos. El procesamiento se canaliza mediante Node.js Streams (`csv-parser`) y lotes encolados en BullMQ (1.000 a 5.000 registros).
4. Seguridad y Modelado Espacial (RNF-03):
   - Persistencia de coordenadas geográficas bajo el sistema de referencia espacial WGS 84 (SRID 4326).
   - Prohibida la interpolación directa de parámetros en sentencias SQL; uso obligatorio de consultas tipadas y parametrizadas en Prisma.
5. Renderizado WebGL Seguro (RNF-02):
   - Aislamiento del contexto gráfico de Deck.gl y MapLibre respecto a la fase de renderizado en servidor (SSR), encapsulando componentes en `<ClientOnly>` o dentro del hook `onMounted`.
