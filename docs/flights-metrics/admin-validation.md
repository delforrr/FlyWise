# Validación desde Admin — tickets 01 y 02

Se requieren PostgreSQL/PostGIS y Redis disponibles, migraciones incrementales aplicadas y un usuario `ADMIN`. En un despliegue nuevo, aplicar `backend/prisma/changes/20261108_identidades_fuente.sql` antes de arrancar esta versión del backend; en la base real local ya está aplicado.

## Cargar los catálogos

1. Ingresar a `/admin` y abrir **Servicios**.
2. Ejecutar, uno por vez y esperando su finalización en **Monitoreo**, los procesos OpenFlights: `countries`, `airports`, `airlines` y `routes`, en ese orden.
3. Ejecutar **OurAirports: paises** y luego **OurAirports: aeropuertos**. Se registran al iniciar el backend. El adapter conoce el formato oficial y no requiere mapear columnas.
4. En Monitoreo revisar filas procesadas, descartes, intentos y eventos. Los descartes incluyen instalaciones fuera del alcance; no indican necesariamente errores de descarga.
5. Repetir la ingesta de aeropuertos: debe conservar identificadores y ediciones protegidas. Reintentar no resuelve las correspondencias pendientes.

OurAirports se programa diariamente a las 03:00 UTC para países y 03:30 UTC para aeropuertos. En Servicios se puede editar la planificación o pausar cada proceso. Para una prueba controlada, ejecutar manualmente cada fuente en el orden anterior.

## Revisar identidades

En **Servicios → Correspondencias pendientes**, cada fila muestra fuente y nombre/código recibido. Buscar un aeropuerto por nombre, código o ciudad, comprobar que sea la misma instalación y pulsar **Vincular**. **Anterior/Siguiente** recorren los pendientes. Si la coincidencia no es segura, dejarla pendiente.

Los identificadores OurAirports y OpenFlights pertenecen a espacios distintos. Vincular no reemplaza una edición manual protegida. Las coincidencias automáticas requieren códigos compatibles y país consistente; compartir un código no prueba por sí solo que sean el mismo aeropuerto.

## Validar métricas y operaciones v1

Usar **Operaciones** para consultar resultados y revisiones, **BTS mensual** para gestionar coberturas completas, **Actividad ANAC** para consultar movimientos, e **Indicadores** para consultar instantáneas de EUROCONTROL.

En **Ver Mapa Global**, abrir **Filtrar puntualidad** para elegir mes y aerolínea. El detalle de la ruta indica cuántas operaciones forman la muestra, sus fuentes y la fecha del cálculo. El mapa toma como punto de partida el último mes BTS completo publicado.

Consultar las [verificaciones por ticket](verification.md#cierre-de-v1) para ver qué se probó con datos oficiales, fixtures y la aplicación local.
