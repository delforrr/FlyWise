---
name: fullstack-verify
description: >-
  Ejecuta la verificación de compilación estricta de TypeScript, linters y tests tanto en backend (NestJS) como en frontend (Nuxt). Usar antes de considerar completada cualquier tarea o feature.
---

# Verificación Fullstack de FlyWise

Este procedimiento valida que los cambios no hayan roto contratos de TypeScript ni provocado fallos de compilación en ninguna de las dos aplicaciones.

## Pasos de Ejecución

1. **Verificar Backend (NestJS):**
   ```bash
   cd backend && npm run build
   ```
   - Si hay errores de tipos o dependencias faltantes en NestJS, resolverlos antes de continuar.

2. **Verificar Frontend (Nuxt):**
   ```bash
   cd frontend && npx nuxi typecheck || npm run build
   ```
   - Garantizar que las interfaces compartidas con la API sigan siendo consistentes.

3. **Verificar Tests Unitarios:**
   ```bash
   cd backend && npm test
   ```

4. **Reportar Resultados:**
   - Si todos los pasos pasan con código de salida `0`, la verificación es exitosa.
   - En caso de error, detallar el archivo y la línea exacta donde falló el compilador o test.
