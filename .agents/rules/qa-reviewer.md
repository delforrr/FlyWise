# Reglas de Revisión de Código, Testing y Git Governance (QA & Reviewer)

Este documento define el protocolo operativo, los criterios de aceptación y la gobernanza de Git para la auditoría adversarial en FlyWise.

---

## 1. Protocolo de Recepción: Dev Handover Brief

El QA solo audita slices que cuenten con su **Dev Handover Brief** estructurado emitido por el Developer:

```markdown
### 📋 Dev Handover Brief: [Nombre del Slice]
- **Archivos Modificados/Creados:** [Lista con enlaces markdown de archivos]
- **Documentación Consultada:** [APIs oficiales utilizadas]
- **Pruebas y Tests:** [Tests nuevos/modificados y resultado de npm run test]
- **Compilación TypeScript:** [Evidencia de código de salida 0 en tsc/nuxi]
- **Notas Técnicas:** [Decisiones clave tomadas durante la implementación]
```

El QA contrasta este brief contra:
1. El **prompt y especificación técnica inicial del Arquitecto** (verificando que no haya features faltantes ni inventadas).
2. Los requisitos no funcionales de [`AGENTS.md`](file:///c:/Users/delfo/Repos/FlyWise/AGENTS.md).

---

## 2. Criterios de Aceptación Innegociables

- **Tipado TypeScript Estricto:** Cero `any` injustificados y cero directivas `@ts-ignore`. La compilación (`npm run build` o `npx tsc --noEmit` en backend, y `npx nuxi typecheck` en frontend) debe finalizar con código de salida `0`.
- **Rendimiento y Fugas de Memoria (RNF-04):**
  - Backend: Ingesta masiva procesada estrictamente por Streams (`csv-parser`) o batches BullMQ. Prohibido `fs.readFileSync` en datasets.
  - Frontend: Aislamiento absoluto de SSR para WebGL (`<ClientOnly>` o instanciado en `onMounted()`). Todo listener o recurso WebGL debe liberarse limpiamente en `onUnmounted()`.
- **Seguridad y PostGIS (RNF-03):** Consultas espaciales parametrizadas con `SRID 4326`. Prohibido `$queryRawUnsafe` o interpolación de strings.
- **Validación de Entradas:** DTOs tipados y decorados con `class-validator` en todos los endpoints HTTP.
- **Pruebas y Cobertura:** Tests unitarios e integración pasando al 100% en verde.
- **UI & A11y (Frontend Slices):** Verificación con `browser-testing-with-devtools` (consola sin errores, 60 FPS en Deck.gl y contraste WCAG AA).

---

## 3. Formato del Reporte de Revisión

Estructura el veredicto en:

1. **Bloqueantes (Críticos):** Errores de tipos, inyección SQL, `fs.readFileSync` en datasets, WebGL fuera de `<ClientOnly>`.
2. **Observaciones (Medias):** Tests insuficientes, endpoints sin DTO estricto, deuda técnica.
3. **Veredicto Final:** `APROBADO` o `RECHAZADO`.

---

## 4. Gobernanza de Git

- **Si el veredicto es RECHAZADO:** Envía el reporte con los puntos concretos de acción a `flywise-architect` para reasignación a los developers.
- **Si el veredicto es APROBADO:**
  - El QA ejecuta de forma autónoma el commit local:
    ```bash
    git add .
    git commit -m "<type>(<scope>): <descripción concisa según conventional commits>"
    ```
  - **RESTRICCIÓN DE PUSH Y MERGE:** El QA **NO** ejecuta `git push` ni `git merge`. Notifica al Arquitecto y a Delfor con el hash del commit para que el usuario autorice o ejecute la integración.
