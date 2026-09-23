# FlyWise — Directrices y Guardrails para Agentes de Desarrollo

> **FlyWise — Sistema de Inteligencia de Vuelos Comerciales y Exploración de Rutas**  
> _Stack:_ NestJS + Prisma + PostGIS (Backend) | Nuxt + Deck.gl + Tailwind v4 (Frontend) | Redis + BullMQ (ETL)

Este documento establece las reglas operativas, restricciones arquitectónicas y guardrails de cumplimiento **OBLIGATORIO** para cualquier agente de IA o desarrollador que trabaje en este repositorio.

---

## 1. Sandboxing y Protección de Ramas (Guardrail de Integridad)

- **Protección estricta de `main` / `master` y `develop`:**
  - **PROHIBIDO SIN EXCEPCIÓN** realizar modificaciones directas en el código fuente de `backend/src/` o `frontend/app/` mientras la rama activa sea `main`, `master` o `develop`.
  - **Protocolo Pre-Vuelo:** Antes de modificar cualquier archivo de código, el agente **DEBE** verificar la rama actual (`git branch --show-current`).
  - Todo cambio, nueva feature o corrección debe desarrollarse en ramas dedicadas siguiendo la convención:
    - `feature/<nombre-descriptivo>`: Nuevas funcionalidades o módulos.
    - `bugfix/<nombre-descriptivo>`: Corrección de errores en desarrollo.
    - `hotfix/<nombre-descriptivo>`: Corrección crítica urgente.
    - `refactor/<nombre-descriptivo>`: Deuda técnica, tipado o mejoras estructurales.
  - _Uso de Git Worktrees o Ramas Locales:_ Para aislar tareas sin alterar la rama base activa, se debe trabajar en ramas dedicadas o `git worktree add ../flywise-feature feature/<nombre>`.

---

## 2. Requisitos No Funcionales e Invariantes de Arquitectura

### 2.1 RNF-04: Pipelines ETL y Manejo de Memoria

- **PROHIBIDO** cargar datasets completos (CSVs de gigabytes provenientes de OurAirports, BTS TranStats, OpenFlights, etc.) en memoria RAM mediante `fs.readFileSync()` o colecciones en memoria no paginadas.
- **OBLIGATORIO:**
  - Procesar archivos masivos exclusivamente mediante **Node.js Streams** (`csv-parser` o streams nativos de Node.js).
  - Distribuir y procesar la información en lotes (_batch chunks_ de 1.000 a 5.000 filas) dentro de workers desacoplados de **BullMQ**.
  - Registrar métricas de filas procesadas, descartadas y tiempos de ejecución para auditoría.

```typescript
// ANTI-PATRÓN (Causa Out-Of-Memory y bloquea el Event Loop):
const content = fs.readFileSync("large_dataset.csv", "utf-8");
const rows = parse(content);

// PATRÓN REQUERIDO:
fs.createReadStream(filePath)
  .pipe(csv())
  .on("data", (row) => batchBuffer.push(row));
```

### 2.2 RNF-03: Seguridad y Acceso a Datos (PostGIS + Prisma)

- **PROHIBIDO** concatenar o interpolar cadenas sin sanitizar en consultas SQL directas:
  - `prisma.$queryRawUnsafe(\`SELECT \* FROM airports WHERE iata = '${input}'\`)`
  - Usar siempre consultas parametrizadas con `prisma.$queryRaw` o métodos del cliente tipado de Prisma.
- **Coordenadas y Geometría:**
  - Todas las coordenadas geográficas de aeropuertos deben persistirse y consultarse bajo el estándar `SRID 4326` (WGS 84).
  - Toda consulta de proximidad o cálculo de distancia ortodrómica debe delegarse a las funciones espaciales de PostGIS (`ST_DWithin`, `ST_DistanceSphere`).
- **Tupla de Agregación Analítica:**
  - La clave de cálculo para OTP-15 es `(originId, destinationId, airlineId, period)`. Las consultas analíticas deben estar respaldadas por índices compuestos en la base de datos.

### 2.3 RNF-02: Rendimiento Gráfico Frontend (Deck.gl + MapLibre + Nuxt)

- **Aceleración por Hardware (WebGL):**
  - Mantener un objetivo de 60 FPS en paneo, rotación y zoom.
  - Los arcos geodésicos de vuelos deben renderizarse mediante `ArcLayer` de Deck.gl coloreados según la métrica OTP-15:
    - **Verde:** OTP-15 $> 85\%$ (Alta puntualidad).
    - **Amarillo:** OTP-15 entre $60\%$ y $85\%$ (Puntualidad moderada).
    - **Rojo:** OTP-15 $< 60\%$ (Baja puntualidad / alta demora).
- **Aislamiento de SSR:**
  - NUNCA inicializar contextos de WebGL, instancias de MapLibre o Deck.gl durante la fase de SSR en Nuxt (causa errores de `window` o `HTMLCanvasElement` no definido).
  - Todas las capas interactivas deben encapsularse dentro de `<ClientOnly>` o instanciarse estrictamente dentro del hook `onMounted()`.
- **Integridad de Tailwind CSS v4:**
  - NUNCA crear ni editar archivos `tailwind.config.js` ni `tailwind.config.ts`.
  - Toda personalización de diseño, colores o fuentes debe residir en los archivos CSS de la aplicación utilizando directivas `@import "tailwindcss"` y bloques `@theme`.

---

## 3. Guardrail de Comandos de Terminal y Gobernanza de Git

- **Comandos Destructivos Restringidos:**
  - **NUNCA** ejecutar comandos que puedan provocar pérdida irreparable de datos o código sin confirmación explícita previa del usuario en el chat:
    - `git reset --hard` / `git push --force`
    - `rm -rf /` o eliminación recursiva de carpetas raíz.
    - `prisma migrate reset` o sentencias SQL `DROP DATABASE` / `TRUNCATE`.
- **Gobernanza de Git por Roles de Agente:**
  - `flywise-developer`: **PROHIBIDO** ejecutar `git commit`, `git push` o `git merge`. Solo ejecuta comandos de lectura (`git status`, `git diff`), compilación y tests (`npm run test`, `tsc --noEmit`).
  - `flywise-qa`: **ÚNICO AGENTE AUTORIZADO** para ejecutar `git add` y `git commit` tras superar el pipeline de validación adversarial. **PROHIBIDO** ejecutar `git push` o `git merge` de forma autónoma; debe solicitar la confirmación explícita del usuario en el chat.
  - `flywise-architect`: Orquesta, consolida y reporta al usuario, gestionando la integración solo con autorización expresa.
- **Modificaciones de Base de Datos:**
  - Priorizar migraciones incrementales mediante `npx prisma migrate dev --name <nombre_migracion>`.
  - Asegurarse de que los contenedores Docker (`flywise_postgres`, `flywise_redis`) estén en ejecución antes de lanzar migraciones o tests.

---

## 4. Módulos y Estructura del Backend (NestJS)

- **Arquitectura Modular:** Cada dominio funcional debe estructurarse en su propio módulo:
  - `src/airports/`: Búsqueda geoespacial y catálogo OurAirports.
  - `src/routes/`: Consulta de tramos, cálculo de arcos y OTP-15.
  - `src/etl/`: Ingesta asíncrona, parsers y jobs BullMQ.
  - `src/metrics/`: Agregación estadística periódica.
  - `src/auth/`: Control de acceso administrativo mediante JWT y Passport.
- **Validación Estricta de Entradas:**
  - Todo endpoint debe tipar sus parámetros y cuerpo con DTOs decorados con `class-validator` y `class-transformer`.
  - Mantener activo el `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.

---

## 5. Quality Gate (Definición de Terminado)

Antes de considerar concluida cualquier tarea o informar al usuario que un cambio está listo, el agente **DEBE verificar de forma autónoma**:

1. **Compilación Estricta de TypeScript (Sin Errores de Tipos):**
   - Backend: `npm run build` o `npx tsc --noEmit` en `backend/` finalizando con código de salida `0`.
   - Frontend: `npx nuxi typecheck` o `npm run build` en `frontend/` sin errores de compilación.
2. **Ausencia de `any` injustificado:** No introducir tipos `any` implícitos ni suprimir errores con `@ts-ignore` sin justificación documentada.
3. **Limpieza de Git:** Verificar con `git status` que no hayan quedado archivos basura temporales (`.bak`, logs, temporales).
