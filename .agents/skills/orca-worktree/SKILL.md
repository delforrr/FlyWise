---
name: orca-worktree
description: >-
  Workflow integral para desarrollo aislado con Orca y Git Worktrees siguiendo convenciones estrictas (feature/, hotfix/, bugfix/, refactor/). Define el ciclo de vida completo: creación de workspaces efímeros, inspección de diffs, verificación de calidad (Quality Gates) y merge seguro.
---

# Workflow de Desarrollo Aislado con Orca (Worktrees & Quality Gates)

Este workflow define el protocolo obligatorio para trabajar en FlyWise sin pisar ramas base (`main` y `develop`), garantizando compilación limpia, tests aprobados y verificación visual antes de integrar cualquier cambio.

> [!NOTE]
> En entornos Linux donde el comando `orca` pertenezca al lector de accesibilidad de GNOME (`/usr/bin/orca`), invoca la CLI de Orca como `orca-ide` o a través del shim configurado en `~/.config/orca/linux-orca-cli-shim/orca`.

---

## 1. Convenciones de Ramas y Rama Base

Toda nueva rama debe seguir el patrón `^(feature|hotfix|bugfix|refactor)/[a-zA-Z0-9._-]+$`:

| Prefijo | Tipo de Tarea | Rama Base | Ejemplo |
| :--- | :--- | :--- | :--- |
| `feature/<nombre>` | Nueva funcionalidad o módulo | `develop` | `feature/deckgl-otp-layer` |
| `bugfix/<nombre>` | Corrección de bug en desarrollo | `develop` | `bugfix/iata-theme-loss` |
| `refactor/<nombre>` | Deuda técnica o refactorización | `develop` | `refactor/package-by-feature` |
| `hotfix/<nombre>` | Corrección urgente en producción | `main` | `hotfix/cors-credentials-fix` |

---

## 2. Fase 1: Creación del Worktree Aislado

1. Asegúrate de que el repositorio principal esté limpio y en la rama base correspondiente.
2. Crea el worktree aislado mediante Orca CLI:
   ```bash
   orca worktree create --name "<rama>" --base-branch "<base>" --setup skip --json
   ```
   *Orca creará el checkout en una ruta aislada (por ejemplo en `~/.local/share/orca/workspaces/...`).*

3. Para despachar un agente o terminal en dicho worktree:
   ```bash
   orca terminal create --worktree "name:<rama>" --command "agy" --json
   ```

---

## 3. Fase 2: Desarrollo e Inspección Continua

Durante el desarrollo dentro del worktree:

1. **Inspección de Diferencias Acumuladas:**
   Ejecuta desde la raíz del repositorio o dentro del worktree:
   ```bash
   git diff --stat <base>...<rama>
   git diff <base>...<rama>
   ```

2. **Verificación Visual E2E con el Navegador de Orca:**
   Utiliza la skill `orca-ui-verify`:
   ```bash
   # 1. Abrir o navegar en Orca Browser
   orca tab create --url http://localhost:3000 --worktree "name:<rama>" --json
   
   # 2. Inspeccionar árbol DOM / accesibilidad
   orca snapshot --worktree "name:<rama>" --json
   
   # 3. Comprobar contexto WebGL de Deck.gl
   orca eval --expression "document.querySelector('canvas') !== null ? 'CANVAS_READY' : 'CANVAS_MISSING'" --worktree "name:<rama>" --json
   
   # 4. Captura de auditoría
   orca screenshot --format png --worktree "name:<rama>" --json
   ```

---

## 4. Fase 3: Compuertas de Calidad (Quality Gate)

Antes de fusionar, el agente o desarrollador **DEBE** ejecutar la verificación estricta en el directorio del worktree (puedes consultar la skill `fullstack-verify`):

### 4.1. Backend (NestJS)
```bash
cd <worktree-path>/backend
npm run build
npm test
```
- Compilación de NestJS debe salir con código `0`.
- Los tests unitarios deben pasar al 100%.

### 4.2. Frontend (Nuxt)
```bash
cd <worktree-path>/frontend
npm run build
```
- Nuxt y Nitro deben compilar sin errores de tipos o SSR.

> [!CAUTION]
> Si cualquiera de las comprobaciones falla, **NO realizar el merge**.
> El agente debe analizar el stacktrace, corregir el código en el worktree y repetir el paso de verificación hasta que ambos builds y tests sean exitosos.

---

## 5. Fase 4: Integración Segura (Merge) y Limpieza

Una vez aprobadas las compuertas de calidad:

1. Cambiar a la rama base en el repositorio principal:
   ```bash
   git checkout <base>
   ```

2. Fusionar los cambios manteniendo el registro histórico:
   ```bash
   git merge --no-ff <rama> -m "merge(<rama>): validado con compuertas de calidad de orca"
   ```

3. Eliminar el worktree efímero en Orca y la rama local:
   ```bash
   orca worktree rm --worktree "name:<rama>" --force --json
   git branch -d <rama>
   ```

---

## 6. Cancelación / Descarte de Tarea (Abort)

Si la tarea se descarta o no cumple los requerimientos:

```bash
# 1. Forzar eliminación del worktree en Orca
orca worktree rm --worktree "name:<rama>" --force --json

# 2. Eliminar la rama sin fusionar
git branch -D <rama>
```
