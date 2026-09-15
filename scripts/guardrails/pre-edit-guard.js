#!/usr/bin/env node
/**
 * FlyWise Pre-Edit Guardrail & Sandboxing Hook
 * 
 * Fired before write_to_file and replace_file_content.
 * Enforces:
 *  1. Worktree Isolation: Blocks edits to backend/src or frontend/app on main or develop.
 *  2. RNF-04: Enforces streaming / BullMQ batches for ETL datasets (blocks fs.readFileSync).
 *  3. Stack Integrity: Blocks tailwind.config.js in Tailwind v4 / Nuxt 4.
 *  4. RNF-03: Blocks SQL string concatenation injection risks.
 *  5. RNF-02: Enforces client-only / onMounted WebGL initialization for Deck.gl in Nuxt.
 */

const { execSync } = require('child_process');
const path = require('path');

function getBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    return 'unknown';
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

async function main() {
  const payload = await readStdin();
  const toolCall = payload.toolCall || {};
  const args = toolCall.args || {};

  const targetFile = args.TargetFile || args.targetFile || args.path || '';
  const codeContent = args.CodeContent || args.ReplacementContent || args.content || '';

  const branch = getBranch();
  const allowDirectEdit = process.env.FLYWISE_ALLOW_DIRECT_EDIT === '1';

  // 1. Sandboxing: Protect main & develop branches from direct code modifications
  const isProtectedBranch = branch === 'main' || branch === 'develop';
  const isSourceCode = targetFile.includes('/backend/src/') || targetFile.includes('/frontend/app/');

  if (isProtectedBranch && isSourceCode && !allowDirectEdit) {
    const denyResponse = {
      decision: 'deny',
      reason: `🛡️ GUARDRAIL BLOQUEADO (Sandboxing & Worktree Protection):
Estás en la rama protegida '${branch}'.
Por directriz de FlyWise, todo desarrollo debe aislarse en un Git Worktree gestionado por Orca.
Por favor consulta la skill 'orca-worktree' o ejecuta:
  orca worktree create --name feature/<nombre-tarea> --base-branch ${branch}
(o hotfix/<nombre>, bugfix/<nombre>, refactor/<nombre>) para trabajar en un entorno seguro sin pisar la rama base.`
    };
    process.stdout.write(JSON.stringify(denyResponse));
    return;
  }

  // 2. Stack Integrity: Nuxt 4 + Tailwind CSS v4
  if (targetFile.endsWith('tailwind.config.js') || targetFile.endsWith('tailwind.config.ts')) {
    const denyResponse = {
      decision: 'deny',
      reason: `🛡️ GUARDRAIL STACK (Nuxt 4 + Tailwind CSS v4):
En Tailwind CSS v4 se prescinde del archivo 'tailwind.config.js'.
La configuración debe realizarse directamente en archivos CSS mediante @import "tailwindcss" y @theme.`
    };
    process.stdout.write(JSON.stringify(denyResponse));
    return;
  }

  // 3. RNF-04: Streaming & Memory Resilience in ETL
  const isEtlFile = targetFile.includes('/backend/src/etl/') || targetFile.includes('etl.');
  if (isEtlFile && (codeContent.includes('readFileSync') || codeContent.includes('readFile('))) {
    const denyResponse = {
      decision: 'deny',
      reason: `🛡️ GUARDRAIL RNF-04 (Tolerancia a fallos y memoria en ETL):
Se detectó el uso de fs.readFile / fs.readFileSync en el pipeline ETL.
Para evitar OutOfMemoryError con datasets masivos (OpenFlights, BTS TranStats),
debes utilizar streams con csv-parser o batches de BullMQ.`
    };
    process.stdout.write(JSON.stringify(denyResponse));
    return;
  }

  // 4. RNF-03: SQL Injection Protection
  if (codeContent.includes('$queryRawUnsafe') || (codeContent.includes('$queryRaw') && /\$queryRaw\s*\(\s*`[^`]*\$\{/.test(codeContent))) {
    const denyResponse = {
      decision: 'deny',
      reason: `🛡️ GUARDRAIL RNF-03 (Seguridad & SQL Injection):
Se detectó interpolación directa de cadenas en una consulta cruda de base de datos.
Utiliza Prisma Client con tagged template strings sanitizadas ($queryRaw\`SELECT ... WHERE id = \${param}\`).`
    };
    process.stdout.write(JSON.stringify(denyResponse));
    return;
  }

  // 5. RNF-02: WebGL Client-Only initialization for Deck.gl in Nuxt 4
  const isFrontendComponent = targetFile.includes('/frontend/app/');
  if (isFrontendComponent && (codeContent.includes('new Deck(') || codeContent.includes('MapboxOverlay'))) {
    const isClientGuarded = codeContent.includes('onMounted') || codeContent.includes('import.meta.client') || codeContent.includes('<ClientOnly>');
    if (!isClientGuarded) {
      const denyResponse = {
        decision: 'deny',
        reason: `🛡️ GUARDRAIL RNF-02 (Rendimiento Gráfico & SSR):
Las capas WebGL de Deck.gl requieren el DOM del navegador.
Asegúrate de inicializar Deck.gl dentro de onMounted() o envolver el componente en <ClientOnly> para evitar fallos de SSR en Nuxt 4.`
      };
      process.stdout.write(JSON.stringify(denyResponse));
      return;
    }
  }

  // All checks passed
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
}

main().catch(() => {
  // If an unexpected error occurs, fail-safe to allow
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
});
