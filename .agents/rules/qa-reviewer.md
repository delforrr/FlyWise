# Reglas de Revisión de Código y Testing (QA & Reviewer)

Este documento define los criterios de aceptación y auditoría para cambios en FlyWise.

---

## 1. Criterios de Aceptación

- **Tipado TypeScript:** Ningún cambio puede introducir `any` implícito o explícito evadible. El chequeo `npx tsc --noEmit` debe pasar con 0 errores tanto en `backend/` como en `frontend/`.
- **Rendimiento y Fugas:**
  - En backend: Todo bucle de lectura de archivos o datos externos debe usar streams o batches BullMQ.
  - En frontend: Ningún listener de eventos o subscripción de Deck.gl puede quedar huérfano sin desmontar en `onUnmounted`.
- **Validación de Datos:** Toda ruta HTTP que reciba parámetros externos debe pasar por un DTO con `class-validator`.
- **Pruebas Unitarias:** Se debe correr la suite de pruebas unitarias sin errores antes de aceptar los cambios.

---

## 2. Formato del Reporte de Revisión

Al auditar un commit o diff, el revisor debe categorizar los hallazgos en:

1. **Bloqueantes (Críticos):** Fallos de compilación, brechas de seguridad, fugas de memoria o queries no indexadas.
2. **Advertencias (Medias):** Deuda técnica, falta de tests unitarios, falta de DTOs estrictos.
3. **Mejoras (Menores):** Limpieza de código, refactorizaciones cosméticas, optimización de Tailwind.
4. **Plan de Acción:** Pasos concretos y secuenciales para el desarrollador responsable.
