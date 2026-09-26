# Reglas de Desarrollo Backend (NestJS + Prisma + BullMQ + PostGIS)

Estas reglas aplican a todo el código en el directorio `backend/` y son de cumplimiento obligatorio en cualquier desarrollo o refactorización de la API.

---

## 1. Arquitectura y Estilo NestJS

- **Modularidad de Dominio:** Cada funcionalidad debe residir en su propio módulo bajo `src/`:
  - `src/airports/`: Búsqueda geoespacial y catálogo de aeropuertos.
  - `src/routes/`: Tramos, cálculo de arcos geodésicos y agregaciones OTP-15.
  - `src/etl/`: Ingesta asíncrona, parsers de datasets y jobs BullMQ.
  - `src/metrics/`: Agregación estadística periódica.
  - `src/auth/`: Control de acceso administrativo mediante JWT y Passport.
- **Inyección de Dependencias:** Utilizar siempre el contenedor IoC nativo de NestJS (`@Injectable()`). Prohibido instanciar servicios manualmente.
- **Validación Estricta de Entradas:**
  - Todos los endpoints deben tipar sus parámetros (`@Param`), query strings (`@Query`) y cuerpo (`@Body`) mediante DTOs dedicados.
  - Decorar cada propiedad del DTO con validadores de `class-validator` y transformadores de `class-transformer`.
  - El `ValidationPipe` global en `main.ts` debe permanecer activo con:
    ```typescript
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    ```
- **Manejo de Errores y Promesas:**
  - Lanzar excepciones HTTP nativas (`NotFoundException`, `BadRequestException`, `ConflictException`, `UnauthorizedException`).
  - Evitar promesas flotantes (floating promises); manejar siempre con `await` o `void` explícito.

---

## 2. Base de Datos & Prisma ORM (RNF-03)

- **PostGIS & Tipos Espaciales:**
  - Todas las coordenadas geográficas de aeropuertos deben persistirse y consultarse bajo el estándar `SRID 4326` (WGS 84).
  - Toda consulta de proximidad o cálculo de distancia ortodrómica debe delegarse a las funciones espaciales de PostGIS (`ST_DWithin`, `ST_DistanceSphere`).
- **Seguridad en Consultas SQL:**
  - **PROHIBIDO** interpolar o concatenar cadenas sin sanitizar en consultas directas.
  - Utilizar siempre consultas parametrizadas con `prisma.$queryRaw` o métodos del cliente tipado de Prisma.
- **Tupla de Agregación Analítica:**
  - La clave de cálculo para puntualidad y demoras (OTP-15) es `(originId, destinationId, airlineId, period)`.
  - Las consultas analíticas deben estar respaldadas por índices compuestos en la base de datos para evitar escaneos secuenciales.
- **Transacciones:** Toda operación atómica que afecte múltiples registros o tablas debe ejecutarse mediante transacciones interactivas de Prisma (`prisma.$transaction`).
- **Docker y Migraciones:** Asegurarse de que los contenedores locales (`flywise_postgres`, `flywise_redis`) estén activos antes de lanzar migraciones (`npx prisma migrate dev`).

---

## 3. Pipelines ETL & BullMQ (RNF-04)

- **Prevención de Agotamiento de Memoria (OOM):**
  - **PROHIBIDO** cargar datasets completos (CSVs de cientos de MB o gigabytes de OurAirports, BTS, OpenFlights) en memoria RAM mediante `fs.readFileSync` o arrays en memoria no paginados.
  - Procesar archivos masivos exclusivamente mediante **Node.js Streams** (`csv-parser` o streams nativos de Node.js).
  - Distribuir y procesar la información en lotes (*batch chunks* de 1.000 a 5.000 filas) dentro de workers desacoplados de **BullMQ**.
- **Resiliencia y Monitoreo:**
  - Configurar reintentos con backoff exponencial en jobs propensos a fallos de red (`attempts: 3, backoff: { type: 'exponential', delay: 2000 }`).
  - Registrar métricas de filas procesadas, descartadas y tiempos de ejecución para auditoría.

---

## 4. Estrategia de Caché & Redis

- Tras completar un pipeline ETL o actualización masiva, refrescar la caché en Redis para las rutas más consultadas y métricas globales agregadas.

---

## 5. Quality Gate Backend (Definición de Terminado)

Antes de dar por completado cualquier cambio en el backend:
1. `npm --prefix backend run build` finaliza con código de salida `0`.
2. `npm --prefix backend run lint` con `0` errores y `0` warnings.
3. `npm --prefix backend test` con el 100% de los tests en verde.
