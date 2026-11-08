# Migración de reglas propias al backend

## Instalación nueva

Usar el contrato actualizado. `functions.sql` únicamente instala PostGIS; `triggers.sql` no crea objetos. Emitir el contrato, inicializar la base y aplicar `constraints.sql` según el README. No ejecutar scripts históricos de renombrado sobre tablas nuevas.

## Base existente

1. Respaldar la base por el procedimiento habitual y detener API/workers antiguos para evitar escrituras durante el cambio.
2. Compilar y desplegar esta versión, que envía ubicación junto con coordenadas y valida configuración ETL en backend. No permitir que escritores antiguos vuelvan a conectarse.
3. Antes de retirar objetos, ejecutar las pruebas de administración/ingesta y equivalencia espacial en una copia de la base con el trigger desactivado dentro de esa copia. Verificar altas y cambios parciales, extremos geográficos y protección concurrente. Mantener el trigger original activo en la base que se desplegará hasta completar esta comprobación.
4. Ejecutar con `psql -v ON_ERROR_STOP=1 -f backend/prisma/changes/20261106_reglas_backend.sql` usando la conexión habitual. La migración es transaccional, no borra filas y puede repetirse.
5. Desde backend ejecutar `npx prisma db verify --schema-only`, luego `npx prisma db sign --no-advance-ref` y `npx prisma db verify`. El firmado actualiza el marcador solo después de validar el esquema. Verificar y probar una edición parcial de coordenadas seguida de consulta por proximidad; ejecutar una importación y comprobar protección manual e historial.

PostGIS, índices, claves y restricciones simples permanecen. El CHECK de instantánea verifica estructura/procedencia, no sustituye la validación de configuración en backend.

Los escritores SQL externos deben proporcionar ubicación coherente y validar configuración explícitamente; ya no reciben esas reglas por trigger o función. Migrar esos scripts antes del despliegue. Los scripts históricos se conservan como historial y pueden contener definiciones antiguas: no volver a aplicarlos después de esta migración.

Para volver a una versión anterior, detener escritores y restaurar las definiciones originales de funciones y trigger antes de reactivar esa versión. No revertir datos ni eliminar tablas. La copia de pruebas usada por el agente no modifica la base de desarrollo.

## Pruebas con escrituras concurrentes

Las suites de concurrencia y BullMQ requieren `FLYWISE_TEST_DATABASE_URL` apuntando explícitamente a una base descartable ya inicializada/migrada. No usan `DATABASE_URL` como fallback. Importan catálogos y recalculan enlaces con commits reales, por lo que no deben dirigirse a una base con datos a conservar. Para ejecutar todas las integraciones, configurar también `DATABASE_URL` con esa misma copia y ejecutar `npm run test:e2e -- --runInBand` desde backend.
