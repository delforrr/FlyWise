# Validaciones internas y operación de la rama

Base de revisión: `2fc7cacdfd4d9294e0b094b902b4c59a2cef06a1` (develop).
Tickets y criterios: `.scratch/backend-data-validation/issues/`.

## Comportamiento

- Los campos marcados `required` se comprueban después de transformar y normalizar. `0` y `false` son datos válidos; espacios, ausencia y códigos inválidos no satisfacen obligatoriedad.
- Un código de catálogo malformado no borra un código válido existente. Un dato explícitamente ausente (`\N`, vacío, `-` o `N/A` en códigos) sigue pudiendo limpiarlo. Se registra el número de códigos inválidos en el evento de advertencia.
- Las consultas de aeropuertos y aerolíneas por código devuelven 409 si hay más de una coincidencia. No se imponen códigos únicos a catálogos históricos.
- La consulta directa admite IATA e ICAO, normaliza espacios y mayúsculas, resuelve identidades inequívocas y rechaza con 400 los extremos iguales, incluso si se usaron dos códigos distintos del mismo aeropuerto. El selector compartido tampoco mantiene extremos iguales mediante v-model.
- Se revalida configuración persistida antes de programar, encolar y ejecutar. Los DTOs, reglas de mapeo y controles de red existentes siguen siendo la fuente de validación; SQL no duplica un motor de mapeo ni un parser cron.
- Cada intento automático tiene su número en el job, eventos y muestras. Los contadores describen el intento actual; `GET /api/etl/jobs/:id/samples` muestra ese intento por defecto. `?attempt=1` permite consultar el anterior. El panel permite seleccionarlo y exporta el número de intento en CSV.
- El intento 0 identifica historial anterior sin procedencia de intento; no se inventa una asignación retrospectiva. El límite de 100 muestras se aplica por job e intento.
- Los vínculos de país inferidos se identifican con `countryLinkInferred`. Se actualizan o despejan cuando cambia la coincidencia inequívoca. Los vínculos explícitos quedan protegidos; al asignar uno manualmente, establecer `country_link_inferred=false`.
- Los vínculos previos sin procedencia registrada se conservan como explícitos por seguridad. No se pueden reclasificar automáticamente sin conocer su origen.
- PostgreSQL rechaza nombres esenciales vacíos, formatos inválidos de códigos presentes, emails sin normalizar y jobs completados sin fechas o contadores completos. No se borran registros para conseguir que una migración pase.
- El arranque rechaza puertos fuera de 1–65535 o fraccionarios, configuración esencial vacía y secretos JWT sin al menos 32 caracteres sin espacios. La longitud es una comprobación mínima, no una medición de entropía. Los errores no incluyen valores de configuración.

## Reglas conservadas

Se mantienen SRID 4326 y el trigger de geografía, coordenadas cero válidas, IATA/ICAO opcionales y no únicos, operadores desconocidos en rutas, aerolíneas inactivas, demoras negativas válidas y claves analíticas compuestas. Flight y RouteMetric siguen sin importador/agregador activo. El requisito de identidad OpenFlights continúa acotado al importador actual; incorporar otro proveedor requiere definir su identidad antes de flexibilizarlo.

Se eliminó SigninRequestDto, que no tenía consumidores y recortaba contraseñas. Login/registro siguen preservando exactamente la contraseña y limitándola a 72 bytes para bcrypt.

## Actualizar una base existente desde el equipo de revisión

1. Instalar dependencias de ambos proyectos y ejecutar `docker compose up -d`.
2. Verificar el SQL base del proyecto: `functions.sql`, `triggers.sql` y el cambio `20261024_catalog_v1.sql`. En particular, `routes_offer_key` debe usar `UNIQUE NULLS NOT DISTINCT`; el contrato de esta RC de Prisma no expresa esa diferencia.
3. Aplicar **una vez**, en orden, los cambios nuevos: `20261029_attempt_audit.sql`, `20261029_country_links.sql`, `20261029_completed_jobs.sql` y `20261029_catalog_invariants.sql`.
4. Desde backend, ejecutar `npm run build`; el prebuild regenera los tipos y contrato ignorados por Git. Después ejecutar `npx prisma db init --dry-run`: debe mostrar cero operaciones tras aplicar los cambios. Ejecutar `npx prisma db init` para firmar y `npx prisma db verify` para comprobar contrato y esquema. No continuar si el plan propone operaciones inesperadas. Los checks nuevos usan la representación canónica de PostgreSQL porque esta RC compara literalmente las expresiones con nombre físico adoptado.
5. Ejecutar `npm test -- --runInBand` y `npm run test:e2e -- --runInBand` en backend. En frontend ejecutar `npm run build` y `npm test -- --maxWorkers=2`.

Ejemplo PowerShell desde la raíz para aplicar **cada archivo pendiente**:

```powershell
Get-Content -Raw backend/prisma/changes/20261029_attempt_audit.sql |
  docker exec -i flywise_postgres psql -U dev_user -d flywise_db -v ON_ERROR_STOP=1
```

Los cambios son transaccionales. Si existen datos incompatibles, la migración falla y revierte; investigar y corregir con una decisión explícita sobre esos registros. No ejecutar resets, truncados ni repetir ciegamente los cambios aditivos.

En una base nueva, instalar funciones antes de crear el contrato actual y el trigger después. El contrato ya contiene las columnas y checks nuevos: no volver a agregar esas columnas con las migraciones de actualización. Aplicar el cambio base para la unicidad con nulos.

## Verificación con datos reales

La integración importa en streaming countries.dat (261), airports.dat (7698), airlines.dat (6162) y routes.dat (67663). Conserva 6161 aerolíneas y 67091 rutas válidas; descarta el marcador Unknown y 572 rutas (incluida PKN → PKN). La segunda importación no inserta rutas. Las transacciones de prueba hacen rollback.

La consulta de enriquecimiento materializa una sola comprobación de unicidad por código en cada lote. La prueba detectó un timeout de 120 segundos; con la corrección, la doble importación pasó en aproximadamente 27 segundos en el entorno local. Es una medición de ese entorno, no una garantía de rendimiento en otros equipos.

La prueba de intentos usa Redis/BullMQ reales, un nombre de cola aleatorio propio, dos procesamientos de airlines.dat y rollback en PostgreSQL; elimina la cola de prueba al terminar. Otra integración ejecuta el backend compilado como proceso hijo y verifica el rechazo de un puerto inválido antes de servir HTTP.
