# Reglas de Desarrollo Backend (NestJS + Prisma + BullMQ + PostGIS)

Estas reglas aplican a todo el código en el directorio `backend/` y son de cumplimiento obligatorio en cualquier desarrollo o refactorización de la API.

---

## 1. Arquitectura y Estilo NestJS

- **Límites por módulo:** En módulos migrados, `entities` conserva invariantes, `metrics` define la política de métricas e `ingestion` coordina casos de uso. El código de dominio y aplicación depende de contratos propios. Adaptadores e infraestructura implementan esos contratos.
- **Composición:** Los módulos NestJS enlazan los puertos con sus implementaciones y exponen los casos de uso al transporte HTTP y a los workers. Mantener las interfaces junto a sus consumidores y limitar `common` a utilidades transversales.
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

### Calidad de código y principios SOLID

- **Agrupar por responsabilidad.** Cada archivo agrupa código que cambia por el mismo motivo. Controllers traducen HTTP, workers traducen jobs, casos de uso coordinan y adaptadores ejecutan I/O. Separar config, historial, importación y publicación cuando cambian por razones distintas.
- **Mantener las funciones pequeñas.** Nombrar por resultado observable. Usar retornos tempranos para errores y casos terminales. Extraer un método privado cuando represente un paso con nombre propio. Darle archivo propio cuando encapsule una regla o un detalle de infraestructura que se pueda verificar por su contrato. Evaluar longitud junto con anidamiento, estado compartido y cantidad de responsabilidades.
- **Diseñar contratos desde el consumidor.** Diseñar interfaces pequeñas con las operaciones que necesita el consumidor y sus garantías de error, orden y atomía. Componer adaptadores en Nest y exigir que cada implementación preserve las garantías del contrato. Reutilizar el contrato existente cuando preserve la semántica y mantener cada invariante en un solo lugar. Reservar la extensión por interfaz para variaciones reales.
- **Ubicar el dominio en TypeScript.** Mantener en el backend la elegibilidad, el cálculo OTP y la autoridad de publicación. PostgreSQL conserva integridad estructural, consultas parametrizadas, transacciones y operaciones PostGIS. Usar Prisma tipado cuando pueda expresar la operación. Dejar explícito qué adaptador abre la transacción y qué escrituras deben confirmarse juntas.
- **Organizar por módulo.** Ubicar primero el código en el módulo dueño. Reservar `common` para utilidades transversales con consumidores reales. Al mover archivos, comprobar imports, exports de Nest, fixtures y arranque. Revisar el cambio con el [estándar de revisión](../../CODING_STANDARDS.md).

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
