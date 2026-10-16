# FlyWise Backend Scaffolding (Iteración 1 - OpenFlights) - Task Tracker

## Phase 1: Branch Setup, Configuration & Dependencies

- [x] Task 1.1: Create dedicated feature branch `feature/backend-scaffolding` adhering to git guardrails.
- [x] Task 1.2: Install required backend packages: `@nestjs/jwt`, `@nestjs/swagger`, `swagger-ui-express`, `passport-local`.
- [x] Task 1.3: Configure `backend/.env` and environment validation schema (`src/config/`).

### Checkpoint 1: Setup & Dependencies

- [x] On dedicated branch `feature/backend-scaffolding`.
- [x] `npm --prefix backend run build` succeeds.

---

## Phase 2: Database Schema & PostGIS Infrastructure

- [x] Task 2.1: Update `backend/prisma/schema.prisma` with OpenFlights models (`User`, `Country`, `Airport`, `Airline`, `Route`, `EtlJob`) and PostGIS extension.
- [x] Task 2.2: Synchronize database schema with PostgreSQL (`prisma db push` / PostGIS active).
- [x] Task 2.3: Implement `PrismaModule` and `PrismaService` with clean lifecycle hooks and raw PostGIS helper methods.
- [x] Task 2.4: Implement `RedisModule` and BullMQ connection setup.

### Checkpoint 2: Database & Infrastructure

- [x] PostgreSQL tables verified in Docker container (`airports`, `airlines`, `routes`, `countries`, `users`, `etl_jobs`).
- [x] PostGIS spatial extension confirmed active.
- [x] Build & lint succeed without errors.

---

## Phase 3: Core Gateway, Swagger, Filters & Health

- [x] Task 3.1: Configure Swagger / OpenAPI in `main.ts` on `/api/docs`.
- [x] Task 3.2: Implement global `HttpExceptionFilter` for standard API error responses.
- [x] Task 3.3: Implement `PerformanceInterceptor` for request duration logging and RNF-01 latency checks.
- [x] Task 3.4: Implement Health Controller (`/api/health`) verifying PostgreSQL + Redis connectivity.

### Checkpoint 3: Gateway & Health Check

- [x] Swagger UI is configured on `http://localhost:3001/api/docs`.
- [x] `GET /api/health` returns `200 OK` with database and redis statuses.

---

## Phase 4: Authentication & Security Module (`src/auth/`)

- [x] Task 4.1: Configure `AuthModule` with `JwtModule` and environment secret.
- [x] Task 4.2: Implement `User` interfaces, DTOs, and controller endpoints.
- [x] Task 4.3: Implement `AuthService` (login and register) and `AuthController`.
- [x] Task 4.4: Implement `JwtStrategy`, `LocalStrategy` and `LocalAuthGuard`.
- [x] Task 4.5: Write comprehensive unit tests for `AuthService`, `AuthController`, `UsersService`, and `UsersController` with Jest.

### Checkpoint 4: Auth & Security

- [x] Unit test suite running with Jest: 6 suites, 31 tests green (100% passing).
- [x] Code coverage reporting configured and functional.
- [x] Linter passing with 0 errors and 0 warnings.

---

## Phase 5: Airports & Countries Modules (`src/airports/`, `src/countries/`)

- [x] Task 5.1: Create DTOs (`SearchAirportsDto`, `NearbyAirportsDto`) with strict `class-validator` rules.
- [x] Task 5.2: Implement `AirportsService` with IATA/ICAO text search and PostGIS `ST_DWithin` spatial query.
- [x] Task 5.3: Implement `AirportsController` (`GET /api/airports/search`, `GET /api/airports/nearby`, `GET /api/airports/:code`).
- [x] Task 5.4: Implement `CountriesService` and `CountriesController` (`GET /api/countries`).
- [x] Task 5.5: Write unit tests for Airports and Countries.

### Checkpoint 5: Airports & Countries

- [x] Search and nearby endpoints respond with typed airport data.
- [x] Tests pass: `npm --prefix backend test`.

---

## Phase 6: Airlines & Routes with Anti-Saturation Engine (`src/airlines/`, `src/routes/`)

- [x] Task 6.1: Implement `AirlinesService` and `AirlinesController` (`GET /api/airlines`, `GET /api/airlines/:code`).
- [x] Task 6.2: Implement Anti-Saturation route ranking formula:
  `Popularity = (AirlinesCount * 2) + log10(OriginRoutes * DestRoutes)`.
- [x] Task 6.3: Implement `RoutesService` and `RoutesController` (`GET /api/routes/explore` returning Top 100 globally by default, and expanding on-demand when `?origin=` or `?airline=` is provided).
- [x] Task 6.4: Implement direct route breakdown (`GET /api/routes/direct?origin=...&destination=...`).
- [x] Task 6.5: Write unit tests for Routes and Airlines.

### Checkpoint 6: Routes & Anti-Saturation

- [x] Top 100 routes deliver high-contrast, intercontinental global network without clutter.
- [x] On-demand querying returns full star/spoke network for selected airport.

---

## Phase 7: ETL Ingestors for OpenFlights Datasets (`src/etl/`) & Sample Seed

- [x] Task 7.1: Set up BullMQ queue `etl-queue` and administrative endpoints (`POST /api/etl/trigger/:dataset`, `GET /api/etl/status`, `GET /api/etl/history`) protected by `JwtAuthGuard`.
- [x] Task 7.2: Implement OpenFlights streaming parser (`csv-parser`) for `airports.dat` and `countries.dat` (filtering commercial IATA airports).
- [x] Task 7.3: Implement streaming parser for `airlines.dat` and `routes.dat` with batch inserts (2.000 rows).
- [x] Task 7.4: Implement seed script (`prisma/seed.ts`) with representative sample (EZE, MIA, JFK, MAD, LHR, HND, GRU, etc.) and calculate initial Top 100 popularity flags.
- [x] Task 7.5: Write unit tests for ETL service and parsers.

### Checkpoint 7: ETL & Data Ingestion

- [x] OpenFlights datasets stream without memory bloat (RNF-04 compliant).
- [x] Popularity scores and `isTop100` flags calculated automatically.

---

## Phase 8: Quality Gate & Final Verification

- [x] Task 8.1: Verify Swagger docs complete on `http://localhost:3001/api/docs`.
- [x] Task 8.2: Verify full Quality Gate: `npm --prefix backend run build` (exit 0).
- [x] Task 8.3: Verify full Quality Gate: `npm --prefix backend run lint` (0 errors, 0 warnings).
- [x] Task 8.4: Verify full Quality Gate: `npm --prefix backend test` (100% tests passing).
