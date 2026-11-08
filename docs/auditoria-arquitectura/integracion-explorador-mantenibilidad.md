# Integración del explorador y mantenibilidad

Fecha: 7 de noviembre de 2026.

Se conservan los cuatro commits originales de `refactor/mantenibilidad-n-capas` (hasta `72ec1d0`). Los cambios pendientes de `bugfix/explorador-rutas` dependen de las consultas extraídas por el refactor; la rama bugfix adopta esos commits como base y agrega únicamente sus diferencias. Luego se integra en el refactor y este en `develop`, sin reescribir el historial.

Las correcciones cubren selección por IATA, estados de carga/error y respuestas concurrentes del explorador, consultas de ida/regreso y ranking global, y recuperación visible del mapa ante fallos. Se conserva la versión más reciente de la verificación del refactor. Los tickets permanecen en `.scratch/`, fuera del seguimiento de Git por decisión del usuario.

## Verificación

- Build backend y frontend: correctos.
- ESLint backend sin autofix: sin errores ni warnings.
- Backend: 209 pruebas, 34 suites, todas verdes.
- Frontend: 204 pruebas, 31 suites, todas verdes.
- Integraciones PostgreSQL/PostGIS y Redis: 50 pruebas, 18 suites, todas verdes sobre `flywise_review_20261106`.
- `git diff --check`: correcto.

## Límites y recuperación

No se aplican migraciones a la base habitual ni se realiza push. Para desplegar sigue siendo necesario el procedimiento de `migracion-reglas-backend.md`.

No se repiten mediciones de latencia ni inspección visual del navegador. Los tickets locales conservan los límites conocidos: umbral global en frío pendiente y origen del 502 histórico sin atribución concluyente.

Se conserva el stash `respaldo-integracion-explorador-20261107` y una copia verificada byte por byte de 340 archivos y del diff original en `/tmp/flywise-integration-backup-20261107`. El stash es un respaldo anterior a la integración; aplicarlo sobre la versión integrada puede generar conflictos y duplicar cambios.
