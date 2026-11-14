# SPEC-06 · Estructura por responsabilidades y límites verificables

Estado: ready-for-agent (documento local; no publicado en tracker).
Fecha: 2026-11-14. Las dependencias y condiciones de habilitación del plan siguen aplicando.

## Problem Statement

Los archivos y módulos actuales mezclan proveedores, coordinación, métricas y persistencia. Mover carpetas sin cambiar dependencias conservaría el acoplamiento.

## Solution

Organizar el backend por responsabilidades con límites de dominio internos, composición explícita y comprobación de dependencias prohibidas.

## User Stories

1. Como desarrollador, quiero localizar adaptadores externos en un lugar consistente, para incorporar o corregir fuentes.
2. Como desarrollador, quiero que cada entidad conserve sus invariantes, para no repartir reglas entre controladores.
3. Como desarrollador, quiero encontrar cálculo y publicación de métricas juntos, para mantener coherencia.
4. Como desarrollador, quiero infraestructura intercambiable mediante puertos, para probar casos de uso.
5. Como equipo, quiero detectar imports que rompen capas, para prevenir regresiones.
6. Como equipo, quiero actualizar reglas y documentación junto con movimientos, para no guiar futuras sesiones con instrucciones obsoletas.
7. Como equipo, quiero mover por módulos con compilación verificable, para aislar errores.
8. Como desarrollador, quiero un common pequeño, para no convertirlo en un depósito de dependencias.

## Implementation Decisions

- Responsabilidades objetivo: adapters para protocolos externos; entities con submódulos de dominio; metrics para política y casos de cálculo/publicación; ingestion para coordinación; infrastructure para PostgreSQL, Redis y BullMQ; common solo elementos transversales concretos.
- Dentro de cada responsabilidad, separar dominio/aplicación/transporte donde sea necesario. entities no significa agrupar todos los modelos ORM: persistencia pertenece a infraestructura.
- Puertos junto al consumidor de alto nivel; implementaciones en adaptadores/infraestructura. Controladores y workers son entradas que invocan casos de uso. DTO de transporte no contamina entidades.
- NestJS compone dependencias, nunca resuelve ciclos mediante service locator en dominio. No inyectar el contenedor o el cliente SQL en una política de métricas.
- Un módulo no puede importar internals de otro; exponer contratos pequeños. Evitar barrel exports que oculten ciclos y repositorios genéricos sin necesidad.
- Mover código solo cuando el ticket migre también importaciones, composición, pruebas, fixtures y documentación afectada. No mezclar un movimiento masivo con cambio de fórmula OTP.
- Actualizar reglas del repositorio que hoy prescriben lógica de negocio en composables y estructura por módulos antiguos; conservar seguridad, streams, PostGIS, Nuxt UI y Quality Gate.
- Elegir la verificación de imports más pequeña compatible con herramientas instaladas; no sumar una dependencia solo para este control.

## Testing Decisions

- Compilación, arranque HTTP y pruebas funcionales por módulo trasladado; precedentes startup, validación, pipelines y métricas.
- Control estático sobre imports de dominio/aplicación hacia proveedores, ORM, colas y transporte; probar que detecta una infracción conocida de fixture.
- Revisión de ciclos y exportaciones; pruebas de contrato público demuestran que un movimiento no altera comportamiento.

## Out of Scope

Microservicios, una interfaz por clase, scaffolding de carpetas vacías, renombrado completo sin beneficio, reconstruir autenticación.

## Further Notes

La estructura es consecuencia de límites y contratos. El árbol orientativo y las dependencias se documentan en el plan y los diagramas, sin fijar archivos internos en esta spec.

Los tickets específicos se enumeran en el plan maestro. Una spec no está implementada por estar documentada ni por tener estado ready-for-agent.
