# SPEC-04 · OAG mínimo y transición incremental

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

Existe una integración parcial sin verificación integrada. Los tickets anteriores no reflejan con precisión lo implementado y el cambio de arquitectura debe conservar el trabajo útil.

## Solution

Cerrar primero un recorrido OAG mínimo verificable, luego desacoplarlo contra el modelo objetivo y avanzar mediante tickets con dependencias, pruebas y revisión adversarial.

## User Stories

1. Como equipo, quiero conservar el trabajo local, para no perder la integración iniciada.
2. Como administrador, quiero cargar un mes y rutas con OAG, para obtener una primera publicación.
3. Como administrador, quiero aprobar la primera publicación real con su evidencia, para evitar datos incompletos.
4. Como equipo, quiero comparar dos adaptadores reales contra un contrato, para validar que la abstracción sirve.
5. Como administrador, quiero programación automática dentro de esta entrega, para no repetir cargas manuales.
6. Como equipo, quiero instalar en una base separada, para probar migraciones sin reemplazar el entorno actual.
7. Como equipo, quiero tickets pequeños con pruebas y revisión adversarial, para ejecutar varias sesiones con continuidad.
8. Como equipo, quiero una demo sintética cuando falten permisos o cobertura, para validar software sin publicar datos no autorizados.

## Implementation Decisions

- Continuar primer incremento OAG en la rama existente, preservando cambios locales. Inventariar qué satisfacen los ocho tickets anteriores y qué falta; no considerar reportes históricos como pruebas del árbol actual.
- Diseñar contratos objetivo antes de ampliar funcionalidades, pero implementar OAG mínimo primero y desacoplar inmediatamente después. No reescribir todo ni desarrollar más proveedores sobre acoplamiento temporal.
- Carga mínima manual: mes cerrado y rutas seleccionadas, paginación completa, operaciones finalizadas, idempotencia y medición de cobertura/cuota. Fuentes opcionales permanecen pausadas por defecto.
- Ante 401/403 detener ejecución y exigir resolver configuración. Ante 429 respetar Retry-After cuando exista; checkpoint confirmado, reintentos limitados y reanudación sin duplicados.
- Primera publicación real requiere aprobación administrativa después de validar descarga, identidad y consistencia. El piloto debe fijar el umbral de cobertura antes de publicación automática; si no hay población de referencia, no inventar un porcentaje.
- Los cron y cargas automáticas forman parte del plan, después del recorrido manual y del coordinador compartido. Desactivar programación impide nuevas corridas; trabajos ya iniciados mantienen estado explícito y cierre consistente.
- BTS valida el segundo adaptador real con fixtures; su descarte masivo se diagnostica antes de declararlo respaldo operativo. No habilitar sustitución automática.
- Base de desarrollo separada para instalación y migraciones; no resetear la actual. No push, merge o operación destructiva sin autorización explícita. Cada ticket posterior usa rama dedicada y base verificada.
- Permisos de almacenamiento/publicación, cuota e histórico real son condiciones externas de habilitación, no entrevistas de diseño pendientes. Nunca incorporar credenciales ni respuestas crudas reales a fixtures.

## Testing Decisions

- Validación principal administrativa -> cola real -> PostgreSQL -> consulta pública, con fixtures sintéticos; precedentes OAG, encolado real, mapa, instalación y BTS.
- Recorrer todos los cursores, repetir ejecución, interrumpir a mitad, agotar cuota y verificar que permanece la publicación anterior.
- Quality Gate completo y E2E pertinentes por incremento; revisión adversarial con evidencias y comparación contra la spec.
- Ensayar base nueva desde cero y migración de datos existentes por separado, sin atribuir éxito a una migración solo porque compila.

## Out of Scope

Connections, Master Data masivo, carga mundial por defecto, producción automática antes de condiciones de publicación, borrar trabajo previo.

## Further Notes

El plan aprobado sustituye decisiones incompatibles del informe exploratorio anterior y recorta productos de pasajeros; no declara listas las implementaciones existentes.

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
