# Reglas de Desarrollo Backend (NestJS + Prisma + BullMQ + PostGIS)

Estas reglas aplican a todo el código en el directorio `backend/` y deben ser respetadas por cualquier agente o desarrollador que modifique la API.

---

## 1. Arquitectura y Estilo NestJS
- **Modularidad:** Cada funcionalidad de dominio debe residir en su propio módulo (`auth`, `airports`, `routes`, `etl`, `metrics`).
- **Inyección de Dependencias:** Utilizar siempre el contenedor de IoC de NestJS. No instanciar servicios manualmente.
- **Validación de Entradas:** Todos los controladores deben tipar sus cuerpos y parámetros con DTOs decorados con `class-validator` y `class-transformer`. El `ValidationPipe` global debe tener `whitelist: true` y `forbidNonWhitelisted: true`.
- **Manejo de Errores:** Lanzar siempre excepciones HTTP nativas de NestJS (`NotFoundException`, `BadRequestException`, `ConflictException`).

---

## 2. Base de Datos & Prisma ORM
- **PostGIS & Tipos Espaciales:**
  - Las coordenadas de aeropuertos deben usar el estándar `SRID 4326` (WGS 84).
  - Toda consulta de proximidad o radio geográfico debe aprovechar funciones nativas de PostGIS (`ST_DWithin`, `ST_DistanceSphere`).
- **Consultas Analíticas y Agregaciones:**
  - La clave de agregación analítica de vuelos es `(originId, destinationId, airlineId, period)`.
  - Asegurar que existan índices compuestos para evitar escaneos secuenciales en tablas con cientos de miles de registros.
- **Transacciones:** Toda operación atómica que toque más de una tabla debe ejecutarse mediante transacciones interactivas de Prisma (`prisma.$transaction`).

---

## 3. Pipelines ETL & BullMQ
- **Prevención de Fugas de Memoria:**
  - Prohibido cargar datasets completos (CSVs de gigabytes) en memoria RAM mediante `fs.readFileSync` o arrays gigantes.
  - Utilizar **Node.js Streams** (`csv-parser`) o procesamiento por lotes (*batch chunks* de 1.000 a 5.000 filas) dentro de los *workers* de BullMQ.
- **Resiliencia y Monitoreo:**
  - Configurar reintentos con backoff exponencial en jobs propensos a fallos de red (`attempts: 3, backoff: { type: 'exponential', delay: 2000 }`).
  - Registrar logs de filas descartadas o con formato inválido para auditoría.

---

## 4. Estrategia de Caché
- Tras completar un pipeline ETL o actualización periódica, ejecutar *cache-warming* en Redis para las 100 rutas más consultadas y métricas globales agregadas.
