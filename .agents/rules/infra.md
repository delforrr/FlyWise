# Reglas de Infraestructura y DevOps (Docker + PostgreSQL PostGIS + Redis)

Estas reglas regulan los archivos `docker-compose.yml`, configuraciones de red, volúmenes y variables de entorno.

---

## 1. Contenedores & Docker Compose

- **Servicios:**
  - `flywise_postgres`: Imagen de PostgreSQL con extensión PostGIS preinstalada (`postgis/postgis:16-3.4-alpine` o similar).
  - `flywise_redis`: Imagen oficial de Redis (`redis:7-alpine`).
- **Persistencia:** Todos los datos de PostgreSQL y Redis deben mapearse a volúmenes nombrados locales (`flywise_pgdata`, `flywise_redisdata`).
- **Healthchecks:**
  - El servicio de base de datos debe incluir un `healthcheck` con `pg_isready` para que los servicios dependientes esperen a que la base esté completamente inicializada.

---

## 2. Variables de Entorno & Seguridad

- Mantener siempre sincronizado `.env.example` en la raíz y en cada submódulo.
- Prohibido hardcodear contraseñas de base de datos o secretos JWT en archivos de código fuente.
