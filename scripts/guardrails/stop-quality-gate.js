#!/usr/bin/env node
/**
 * FlyWise Stop Quality Gate Hook
 * 
 * Fired when the agent execution loop terminates.
 * Inspects .agents/diagnostics.log. If unhandled syntax errors exist,
 * forces the agent to continue and fix them.
 */

const fs = require('fs');
const path = require('path');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });
}

async function main() {
  await readStdin();

  const repoRoot = path.resolve(__dirname, '../..');
  const diagnosticsLog = path.join(repoRoot, '.agents/diagnostics.log');

  if (fs.existsSync(diagnosticsLog)) {
    const content = fs.readFileSync(diagnosticsLog, 'utf-8').trim();
    if (content.length > 0) {
      // Consume the log and ask the agent to fix
      fs.unlinkSync(diagnosticsLog);
      process.stdout.write(JSON.stringify({
        decision: 'continue',
        reason: `🛡️ QUALITY GATE: Se detectaron advertencias de sintaxis durante la sesión:\n${content}\nPor favor corrígelas antes de dar la tarea por concluida.`
      }));
      return;
    }
  }

  process.stdout.write(JSON.stringify({}));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({}));
});
