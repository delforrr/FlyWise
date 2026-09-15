#!/usr/bin/env node
/**
 * FlyWise Post-Edit Verification Hook
 * 
 * Fired on PostToolUse after write_to_file / replace_file_content.
 * Checks git status for modified files and performs fast syntax checks,
 * writing any warnings to .agents/diagnostics.log.
 */

const { execSync } = require('child_process');
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

  try {
    const status = execSync('git status -s', { cwd: repoRoot, encoding: 'utf-8' });
    const changedFiles = status
      .split('\n')
      .map(line => line.trim().slice(3))
      .filter(f => f && (f.endsWith('.ts') || f.endsWith('.vue') || f.endsWith('.json')));

    if (changedFiles.length === 0) {
      process.stdout.write(JSON.stringify({}));
      return;
    }

    const logs = [];
    const timestamp = new Date().toISOString();

    for (const file of changedFiles) {
      const fullPath = path.join(repoRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      if (file.endsWith('.json')) {
        try {
          JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        } catch (e) {
          logs.push(`[${timestamp}] [JSON_SYNTAX_ERROR] en ${file}: ${e.message}`);
        }
      }
    }

    if (logs.length > 0) {
      fs.appendFileSync(diagnosticsLog, logs.join('\n') + '\n');
    }
  } catch (err) {
    // Fail silently in post-tool
  }

  process.stdout.write(JSON.stringify({}));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({}));
});
