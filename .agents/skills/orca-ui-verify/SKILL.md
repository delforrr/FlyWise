---
name: orca-ui-verify
description: >-
  Verifica visual y funcionalmente la aplicación frontend (Nuxt 4 + Tailwind CSS + Deck.gl) en el navegador integrado de Orca. Captura árboles de accesibilidad, comprueba montaje de WebGL y screenshots de auditoría.
---

# Verificación UX/UI y Frontend con Orca Browser

FlyWise requiere que las visualizaciones de mapas aceleradas por hardware (Deck.gl y MapLibre GL JS) se inicialicen sin excepciones en el DOM del cliente.

## Procedimiento Paso a Paso

1. **Asegurar el Servidor Nuxt en el Worktree:**
   ```bash
   orca terminal create --worktree active --command "cd frontend && npm run dev"
   ```

2. **Abrir Pestaña de Navegación en Orca:**
   ```bash
   orca tab create --url http://localhost:3000 --worktree active
   ```

3. **Capturar Árbol de Accesibilidad (Snapshot):**
   ```bash
   orca snapshot --worktree active
   ```
   - Detectar referencias de elementos como `@e1`, `@e2` para inputs de búsqueda, selector de aeropuertos y botones de filtro.

4. **Comprobar Inicialización de Canvas WebGL:**
   ```bash
   orca eval --worktree active --expression "document.querySelector('canvas') !== null"
   ```
   - Debe retornar `true`. Si retorna `false` o lanza error de contexto, revisar que el mapa esté contenido en un bloque `<ClientOnly>`.

5. **Interactuar con Controles (Simulación de Usuario):**
   ```bash
   # Escribir código IATA en input de búsqueda
   orca fill --worktree active --element @e2 --value "EZE"
   orca keypress --worktree active --key Enter
   ```

6. **Capturar Screenshot de Auditoría:**
   ```bash
   orca screenshot --format png --worktree active
   ```
