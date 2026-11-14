# FlyWise · Plan de arquitectura y confiabilidad

Consolidado: 2026-11-14. Estado: planificación aprobada en conversación; implementación pendiente de evidencia por ticket.

## Objetivo y precedencia

Una base genérica y mínima, reglas de negocio en backend, alto nivel dependiente de contratos, frontend de presentación, cargas manuales y programadas y una publicación vigente trazable por población.

Este plan y sus seis specs sustituyen las decisiones incompatibles de [integración anterior](plan-integracion-servicios.md) y del informe exploratorio. La evaluación OAG mencionada en el handoff es evidencia histórica, no certificación del árbol actual; su archivo fue eliminado del árbol durante esta sesión por un cambio externo a esta tarea y no se restaura aquí. Se recorta expresamente pasajeros/PAX y capacidades sin aporte a confiabilidad. Los diagramas anteriores se conservan como antecedentes, no como arquitectura objetivo.

No hay tracker configurado. Los tickets locales usan ready-for-agent como vocabulario de triage; las dependencias y condiciones externas siguen bloqueando ejecución/cierre. Para publicación externa ejecutar /setup-matt-pocock-skills y configurar destino. Esta entrega no publica issues, hace commits ni implementa los tickets.

## Specs independientes

- [SPEC-01 · Base de datos mínima sin reglas de negocio](specs/01-base-datos-minima.md) — tickets [T03](tickets/T03.md), [T06](tickets/T06.md), [T07](tickets/T07.md), [T08](tickets/T08.md), [T09](tickets/T09.md).
- [SPEC-02 · Arquitectura limpia por contratos](specs/02-arquitectura-por-contratos.md) — tickets [T04](tickets/T04.md), [T05](tickets/T05.md), [T10](tickets/T10.md).
- [SPEC-03 · Administración clara y frontend de presentación](specs/03-frontend-presentacion.md) — tickets [T11](tickets/T11.md), [T14](tickets/T14.md), [T15](tickets/T15.md), [T16](tickets/T16.md).
- [SPEC-04 · OAG mínimo y transición incremental](specs/04-implementacion-oag-transicion.md) — tickets [T00](tickets/T00.md), [T01](tickets/T01.md), [T12](tickets/T12.md), [T20](tickets/T20.md).
- [SPEC-05 · Redis y BullMQ: rendimiento y recuperación](specs/05-redis-bullmq.md) — tickets [T13](tickets/T13.md), [T17](tickets/T17.md), [T18](tickets/T18.md).
- [SPEC-06 · Estructura por responsabilidades y límites verificables](specs/06-estructura-concerns.md) — tickets [T02](tickets/T02.md), [T19](tickets/T19.md).

## Decisiones cerradas

- Conservar PK/FK/UNIQUE/NOT NULL, índices y PostGIS. Retirar reglas SQL propias después de trasladarlas y probarlas en backend; SQL de acceso y agregación técnica sigue permitido.
- Solo operaciones finalizadas; cuatro horarios disponibles, sin inventarlos. Mes por salida programada local; fecha operativa alternativa cuando no existe instante. No duplicar fecha por comodidad.
- OTP llegada v1: <=15 minutos puntual; cancelados fuera del denominador; desviados no puntuales dentro; insuficiente evidencia excluida y visible en cobertura. Denominador cero es Sin datos. Color: >85 verde, 60–85 amarillo, <60 rojo, sin datos gris.
- Una fuente publicada por tramo/operadora/mes. OAG predeterminado. Cambiar la fuente requiere autorización explícita capturada en la ejecución y un reemplazo validado. Una sola ingesta de operaciones activa, desde la admisión hasta la promoción o el cierre definitivo. PostgreSQL protege la admisión manual/cron.
- Primera publicación real aprobada por administrador; el piloto fija umbral de cobertura antes de automatizar publicación. No estimar cobertura total a partir de una muestra sin referencia.
- CRUD de servicios y cargas configurables existentes se conservan. Adaptadores conocidos simplifican parámetros; nuevas APIs requieren implementación. Archivo en lugar de borrar servicios con historial.
- Carga manual mínima primero; cron en esta misma entrega. Formularios con frecuencia/horario/zona, selects y autocompletado. Nuevos servicios pausados hasta validar carga.
- El cron captura el último mes calendario cerrado al comenzar. Una carga manual conserva el mes explícito. Las repeticiones generan candidatas que pueden incorporar cambios tardíos del proveedor.
- Admin edita catálogos y consulta operaciones y métricas. Operaciones de fuente inmutables por ejecución, sin alta ni corrección manual, historial por fila o conciliación.
- Cada candidata usa sus propias filas. Promover actualiza juntos los conteos y el puntero a la ejecución. Una carga parcial, fallida o de cobertura incierta conserva lo publicado. Un vacío verificado produce Sin datos. La limpieza de filas anteriores se hace después, según retención y solo si ninguna publicación vigente las necesita. Solo Admin ve actualización, fallos, aprobación y reintentos.
- Mapa limitado a doce meses calendario cerrados, backend conserva histórico sin purga por ventana. Restricciones contractuales reales de retención son condición de habilitación por proveedor, no una autorización implícita para borrar.
- Rutas y ofertas pueden existir sin operaciones. Se conserva protección manual del catálogo y trazabilidad de ejecuciones y publicaciones. PAX/pasajeros y datos ajenos a confiabilidad se retiran junto con sus consumidores.

## Arquitectura objetivo y responsabilidades

| Responsabilidad | Propietario | Límites |
| --- | --- | --- |
| Invariantes de catálogos/operaciones | entities con submódulos de dominio | No ORM, HTTP, Nest, colas ni proveedores en dominio |
| OTP, revisión candidata y promoción | metrics | No dependencia de OAG/BTS; usa puertos propios |
| Configuración, ejecución y coordinación | ingestion | Selecciona adaptadores por capacidad; no reimplementa OTP |
| Lectura y traducción externas | adapters | OAG/BTS/archivos y capacidades útiles; sin autoridad de publicación |
| Repositorios, caché y trabajos | infrastructure | Implementa puertos y transacciones |
| Transporte y composición | controladores/workers y módulos Nest | Validan entrada y llaman casos de uso |
| Elementos transversales concretos | common | No depósito de reglas ni dependencia circular |

Árbol orientativo: backend/src/adapters/, entities/, metrics/, ingestion/, infrastructure/, common/. Las capas internas se crean donde aportan; no se exige una interfaz por clase. La API pública entrega métricas y semántica preparadas; un BFF solo se introduce si la auditoría demuestra que elimina composición innecesaria. No se crea otro despliegue por defecto.

## Plan de sesiones y dependencias

El orden es OAG mínimo -> límites/contratos -> desacoplamiento con dos adaptadores -> modelo mínimo y publicación durable -> servicios/programación y administración -> caché/estructura final -> aceptación. Los IDs orientan el orden, las dependencias exactas mandan.

| Ticket | Spec | Resultado | Depende de |
| --- | --- | --- | --- |
| [T00](tickets/T00.md) | 04 | Conciliar trabajo existente y fijar línea base | — |
| [T01](tickets/T01.md) | 04 | Cerrar recorrido OAG mínimo | T00 |
| [T02](tickets/T02.md) | 06 | Fijar límites y reglas de dependencias | T01 |
| [T03](tickets/T03.md) | 01 | Inventariar y trasladar invariantes SQL | T02 |
| [T04](tickets/T04.md) | 02 | Centralizar cálculo y publicación por contratos | T02 |
| [T05](tickets/T05.md) | 02 | Validar el contrato con BTS | T04 |
| [T06](tickets/T06.md) | 01 | Incorporar horarios y período reproducible | T03, T04 |
| [T07](tickets/T07.md) | 01 | Normalizar identidades y catálogo | T05, T06 |
| [T08](tickets/T08.md) | 01 | Retirar datos ajenos a confiabilidad | T07 |
| [T09](tickets/T09.md) | 01 | Contraer esquema y retirar reglas SQL | T03, T07, T08 |
| [T10](tickets/T10.md) | 02 | Hacer durable la admisión exclusiva, el cálculo y la promoción | T04, T06 |
| [T11](tickets/T11.md) | 03 | Unificar CRUD de servicios | T05 |
| [T12](tickets/T12.md) | 04 | Validar piloto y aprobar primera publicación | T05, T06, T10, T11 |
| [T13](tickets/T13.md) | 05 | Unificar programación y recuperación de cargas | T10, T11 |
| [T14](tickets/T14.md) | 03 | Unificar entidades y operación finalizada en administración | T06, T07, T08, T11 |
| [T15](tickets/T15.md) | 03 | Preparar lecturas y reducir lógica frontend | T04, T10, T14 |
| [T16](tickets/T16.md) | 03 | Cerrar UX y mapa público | T13, T15 |
| [T17](tickets/T17.md) | 05 | Medir y asegurar Redis y BullMQ | T13 |
| [T18](tickets/T18.md) | 05 | Cachear lecturas con coherencia de publicación | T15, T17 |
| [T19](tickets/T19.md) | 06 | Completar movimientos por responsabilidad | T09, T10, T13, T15 |
| [T20](tickets/T20.md) | 04 | Validación integral y cierre adversarial | T12, T16, T18, T19 |

Sesiones sugeridas: A T00–T01; B T02–T05; C T06–T09; D T10–T13; E T14–T16; F T17–T19; G T20. No comprometen duración ni obligan a ejecutar varios tickets si el gate falla.

### Gobierno de ramas

T00 y T01 se ejecutan sobre feature/integracion-servicios, sin descartar sus cambios locales. Los demás tickets proponen su propia rama. Antes de cualquier modificación comprobar rama y estado. Partir del commit validado que reúne dependencias; cuando aún no haya integración autorizada, usar ramas apiladas explícitas y registrar su base. No asumir dependencias fusionadas. No hacer merge/push sin autorización. Commit atómico solo después del gate. No modificar backend/src ni frontend/app sobre main/master/develop.

### Reconciliación con los tickets anteriores

| Ticket anterior | Continuidad |
| --- | --- |
| 01 Registro servicios | T00 inventario, T11 CRUD y T13 programación |
| 02 OTP OAG | T01 mínimo, T04 cálculo común, T12 piloto |
| 03 Mes mapa | T15–T16 contrato y UX |
| 04 Actividad ANAC | T08 recorte: conservar únicamente aporte explícito a confiabilidad |
| 05 Indicadores EUROCONTROL | T08 revisión por producto, nunca mezclar indicador externo con OTP |
| 06 BTS opcional | T05 contrato y diagnóstico |
| 07 Instalación limpia | T09 esquema y T20 aceptación |
| 08 Panel resultados | T15–T16 lecturas y presentación |

Los archivos anteriores no prueban estado de implementación. T00 levanta evidencias y evita duplicar trabajo realizado.

## Migración y datos

Inventario por columna: finalidad, consumidores, carácter canónico/derivado/origen, destino, transformación, verificación y retiro. El ticket no elimina campos por su nombre. idOpenflights se traslada; cantidadRutas deja de ser mutable; países sin resolver conservan evidencia; coordenadas/geometría siguen por rendimiento espacial; pasajeros y datos exclusivos de actividad salen del producto; se conserva la trazabilidad por ejecución y publicación.

Usar expansión -> copia/validación -> cambio de consumidores -> contracción. Base separada para pruebas. No resetear el entorno habitual. La versión instalada usa contrato Prisma y scripts propios: verificar comandos compatibles en T00/T09 en vez de asumir que una instrucción de migración genérica aplica a esta versión. Una vuelta de código no equivale a restaurar datos; definir recuperación por migración antes de ejecutarla.

## Quality Gate y revision adversarial

Por ticket: pruebas de comportamiento en el punto más alto útil, preferentemente HTTP administración -> trabajo -> lectura pública. Reusar suites de OAG, BTS, vuelos-métricas, pipelines, encolado real, mapa, identidad y catálogo. Casos puros adicionales solo para fronteras de cálculo/tiempo. Interfaces no se validan únicamente con mocks.

1. Comprobar PostgreSQL y Redis disponibles antes de tests/migraciones. Usar base aislada cuando haya fixtures destructivos.
2. Backend: npm run build y npm test. Lint sin errores ni warnings; evitar ejecutar un autofix sobre cambios ajenos, usar el equivalente de solo comprobación cuando corresponda.
3. Frontend: npm run build o nuxi typecheck, y npm test. Ejecutar E2E afectados por separado: npm test backend no incluye automáticamente su suite E2E.
4. Pruebas de concurrencia, migración, recuperación y autorización pertinentes al ticket. UI: navegador, teclado, viewport móvil, consola y SSR; mapa con WebGL solo cliente.
5. Revisar ausencia de any injustificado y ts-ignore, y git status sin basura. Cambios previos del usuario se conservan y se distinguen del ticket.
6. Agente adversarial independiente recibe spec, diff y evidencia: busca contraejemplos, doble conteo, publicación parcial u obsoleta, fuga de secretos y estados administrativos públicos. No escribe cambios durante revisión. Hallazgos accionables se corrigen antes de cerrar y se repiten los controles afectados.
7. Handoff por sesión con base/commit, tickets cerrados, evidencia y bloqueos. Sin merge/push autónomos.

La planificación documental actual se valida por cobertura de decisiones, enlaces, DAG y coherencia cruzada; no certifica builds ni tests de la aplicación existente. T00 debe establecer esa línea base.

## Diagramas

- [Dependencias entre capas](diagrams/01-capas.mermaid).
- [Diagrama de clases](diagrams/02-clases.mermaid).
- [DER de catálogo y puntualidad](diagrams/02-dominio.mermaid).
- [Carga y publicación](diagrams/03-carga-publicacion.mermaid).

Todos los diagramas nuevos y sus fuentes Mermaid residen en docs/diagrams/. El diagrama de dominio no es DDL ni obliga a una tabla por nodo; T06–T09 concretan el modelo mínimo comprobable.

## Condiciones externas y cierre

Permisos OAG, histórico accesible, cuota, cobertura y retención no están certificados por esta planificación. T12 documenta evidencia sin exponer secretos ni respuestas brutas. Sintéticos validan comportamiento, no cobertura ni licencia. Si el piloto no pasa, conservar publicación válida y mantener OAG real sin habilitar; no presentar el sistema como completado con datos reales.

No hay objetivo numérico de latencia inventado: T17 registra baseline y T18 debe demostrar mejora medible sin regresiones. El presupuesto y umbral de cobertura se fijan con evidencia del piloto, no con un valor arbitrario. El alcance funcional queda cerrado; estas son condiciones operativas verificables.
