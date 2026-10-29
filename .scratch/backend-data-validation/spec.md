# Especificación aprobada: validación interna del backend

Base fija: 2fc7cacdfd4d9294e0b094b902b4c59a2cef06a1 (develop).
Rama: refactor/backend-data-validation.

El usuario aprobó los tickets 01–13 y las fronteras HTTP, ETL con PostgreSQL/Redis reales, SQL directo e interfaz afectada. Autorizó usar los .dat para descubrir nuevos criterios; de esa prueba surgió el ticket 14 de rendimiento del enriquecimiento.

## Entregables

- Tickets individuales con dependencias y evidencia verificable en issues/.
- Obligatoriedad después de transformar y normalizar sin rechazar cero o false.
- Rechazo explícito de códigos ambiguos, sin imponer unicidad histórica.
- Preservación de códigos válidos ante entradas malformadas; ausencia explícita sigue diferenciándose.
- Revalidación de configuración persistida al programar, encolar y ejecutar.
- Auditoría por intento: muestras/eventos identificables y contadores del intento actual; acceso a evidencia anterior desde API y panel.
- Actualización de relaciones de país inferidas y preservación de relaciones explícitas. No inventar la procedencia histórica.
- Restricciones de jobs completados y catálogos también para escritores SQL.
- Contrato IATA/ICAO claro y rechazo de extremos iguales en consulta directa, exploración y selección de la interfaz.
- Validación de puertos, configuración esencial y secreto JWT en el arranque.
- Eliminación del DTO sin consumidores y decoradores redundantes. Conservar controles de seguridad, datos históricos válidos y reglas documentadas de catálogo.
- Doble importación de los .dat con idempotencia, enriquecimiento correcto y sin aumentar el timeout existente.
- Compilaciones, suites y E2E verdes; commits atómicos en la rama dedicada.
- Revisión adversarial independiente, corrección de sus hallazgos y documento final con motivos e impactos reales para usuario, operador y desarrollador.
- Todos los cambios y el documento del agente adversarial deben quedar commiteados.

No se autorizó push ni merge. No se incorporan nuevos proveedores, importadores de puntualidad ni rediseño visual.
