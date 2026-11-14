# SPEC-03 · Administración clara y frontend de presentación

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

La navegación refleja proveedores e infraestructura y obliga a entender procesos técnicos. Parte de las decisiones y composición de resultados puede quedar duplicada en frontend.

## Solution

Administrar catálogos y configuración de servicios con formularios mínimos. Mostrar operaciones y métricas en modo lectura. Separar monitoreo administrativo de lectura pública.

## User Stories

1. Como administrador, quiero crear servicios configurables, para reutilizar cargas.
2. Como administrador, quiero elegir proveedor, mes y rutas con selects y autocompletado, para ejecutar sin conocer sus APIs.
3. Como administrador, quiero editar correspondencias de archivos compatibles cuando sean necesarias, para conservar las modalidades actuales.
4. Como administrador, quiero activar, pausar y programar cargas sin escribir cron, para mantener datos automáticamente.
5. Como administrador, quiero archivar servicios con historial, para retirar configuraciones sin borrar ejecuciones.
6. Como administrador, quiero consultar operaciones finalizadas y métricas, con la procedencia de la carga disponible en monitoreo.
7. Como administrador, quiero gestionar usuarios y catálogos, para mantener identidades y acceso.
8. Como administrador, quiero ver progreso, fallos y reintentos, para resolver problemas.
9. Como usuario, quiero ver la última publicación válida sin mensajes de procesos internos, para explorar sin interrupciones.
10. Como usuario, quiero rutas sin datos en gris, para distinguirlas de OTP cero.
11. Como usuario de teclado o móvil, quiero controles accesibles y formularios claros, para completar acciones sin barreras.
12. Como usuario, quiero meses explícitos respetados y doce meses cerrados disponibles, para elegir el período.

## Implementation Decisions

- Navegación por Monitoreo, Servicios, Usuarios y catálogos: aeropuertos, aerolíneas, países y rutas/ofertas. Las consultas de operaciones y métricas son de solo lectura. Eliminar entradas de navegación por OAG/BTS/ANAC.
- Conservar crear/leer/editar/archivar servicios. Un servicio configura una modalidad o proveedor instalado; se conservan cargas compatibles de archivos/conexiones y correspondencias existentes. No prometer integración automática de cualquier API.
- Proveedor predeterminado OAG; carga inicial manual por mes cerrado y una o varias rutas. Programación en esta entrega, inicialmente pausada hasta validar primera carga; frecuencia y horario amigables, zona horaria explícita.
- Mostrar salida y llegada en la consulta de operaciones. Cancelación y desvío admiten ausencia de horarios según dominio. Autocompletado en catálogos envía IDs estables.
- Retirar formularios y endpoints administrativos de alta, edición, archivo, restauración, restablecimiento de fuente, historial y conciliación de operaciones. La ingesta es la entrada de operaciones y la publicación calcula las métricas.
- Frontend solo presentación, interacción y validación orientativa; clasificación OTP, elegibilidad, autoridad de fuente, filtros de negocio y composición semántica pertenecen al backend. Transformaciones visuales no son reglas de negocio.
- Auditar consultas y composición actuales. Preferir endpoints de lectura del backend adaptados al panel; introducir BFF solo si el inventario prueba composición innecesaria, sin duplicar dominio ni crear un servicio desplegable adicional sin necesidad.
- Actualizar, errores de carga, aprobación inicial y reintentos solo para administradores, protegidos también en API. Mostrar el ID activo ante un conflicto de ingesta. Para reemplazar una fuente ya publicada, exigir confirmación explícita del cambio y mantener visible la fuente anterior hasta la promoción. Respuestas públicas no exponen errores internos, referencias a secretos o detalles de proveedor innecesarios.
- Mapa: verde >85%, amarillo entre 60% y 85%, rojo <60%, gris sin datos. OTP cero es rojo cuando existe denominador. Con mes vacío elegir el último publicado dentro de doce meses cerrados; mes explícito no se sustituye.
- Reutilizar Nuxt UI y Lucide, tokens Tailwind v4, foco visible, labels y errores por campo. Aplicar claridad y consistencia de taste al panel; no introducir hero, efectos o secciones de marketing en un CRUD.
- Indicadores externos útiles son consulta, no edición de porcentajes derivados; conservar atribución exigida donde corresponda sin introducir jerga técnica en acciones cotidianas.

## Testing Decisions

- Pruebas HTTP de autorización y contrato público/administrativo más recorridos de UI; precedentes servicios/pipelines, usuarios, operaciones, catálogos, filtros y tarjetas del mapa.
- Verificar carga, edición y archivo de catálogo, autocompletado, permisos y ausencia de acciones de escritura sobre operaciones o métricas. Cubrir Sin datos, OTP cero y estado de actualización visible solo a administradores.
- Revisión visual real en 1440, 1024, 768 y 390; teclado, contraste, objetivos táctiles, consola e hidratación SSR. WebGL solo cliente.
- Comparar número de peticiones y cálculos en cliente antes/después; cualquier BFF debe demostrar la carga que elimina.

## Out of Scope

Rediseño comercial de landing, nuevas entidades sin caso de uso, panel de infraestructura pública, frontend calculando métricas.

## Further Notes

La aplicación conserva SSR seguro y objetivo de 60 FPS del mapa. Retirar funcionalidades de pasajeros incluye sus pruebas y consumidores, no esconder una pestaña solamente.

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
