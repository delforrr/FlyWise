#!/usr/bin/env node
/**
 * FlyWise Pre-Command Read-Only Inspector Hook
 * 
 * Fired before run_command execution.
 * Automatically approves ("allow") any command that is strictly read-only
 * in Bash, Zsh, Sh, and PowerShell.
 * 
 * Intercepts pipes, compound commands (&&, ||, ;), and checks for file redirections (>).
 */

const readline = require('readline');

const READ_ONLY_BINARIES = new Set([
  // Files & directory inspection
  'ls', 'dir', 'cat', 'head', 'tail', 'more', 'less', 'file', 'stat', 'wc', 'du', 'df',
  'find', 'fd', 'locate',
  // Search & Text processing
  'grep', 'egrep', 'fgrep', 'rg', 'ripgrep', 'awk', 'sed', 'jq', 'sort', 'uniq', 'diff', 'colordiff', 'cmp',
  'cut', 'tr', 'fmt', 'fold', 'column',
  // Process & System info
  'ps', 'top', 'htop', 'pgrep', 'pidof', 'uptime', 'whoami', 'id', 'uname', 'hostname', 'free', 'vmstat',
  'lsof', 'netstat', 'ss', 'ip', 'ifconfig', 'printenv', 'env', 'date', 'cal',
  // Output & Resolution
  'echo', 'printf', 'which', 'type', 'whereis', 'where', 'pwd', 'true', 'false',
  // PowerShell cmdlets (case-insensitive in Windows/PowerShell)
  'get-process', 'get-childitem', 'get-content', 'select-string', 'get-location', 'write-output',
  'get-command', 'get-help', 'test-path', 'measure-object', 'get-service', 'get-date'
]);

const READ_ONLY_SUBCOMMANDS = {
  git: new Set(['status', 'diff', 'log', 'branch', 'show', 'tag', 'remote', 'rev-parse', 'describe', 'cat-file', 'config --get', 'config -l']),
  docker: new Set(['ps', 'logs', 'images', 'inspect', 'version', 'info', 'stats', 'top']),
  'docker-compose': new Set(['ps', 'logs', 'config', 'images', 'version']),
  orca: new Set(['status', 'repo', 'worktree', 'terminal', 'tab', 'snapshot', 'diagnostics'])
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function isSubcommandReadOnly(tool, args) {
  const allowed = READ_ONLY_SUBCOMMANDS[tool];
  if (!allowed) return false;

  const firstArg = args[0] ? args[0].toLowerCase() : '';
  if (allowed.has(firstArg)) return true;

  // Check two-word subcommands like "docker compose ps" or "git rev-parse"
  if (args.length >= 2) {
    const twoArgs = `${firstArg} ${args[1].toLowerCase()}`;
    if (allowed.has(twoArgs)) return true;
  }

  // Check options like -v, --version, --help
  if (firstArg === '--help' || firstArg === '-h' || firstArg === '--version' || firstArg === '-v') {
    return true;
  }

  return false;
}

function isSingleCommandReadOnly(cmdStr) {
  const trimmed = cmdStr.trim();
  if (!trimmed) return true;

  // Check for destructive file output redirection (> or >> or tee)
  if (/>\s*[^&]/.test(trimmed) || trimmed.includes('| tee ') || trimmed.startsWith('tee ')) {
    return false;
  }

  // Split tokens respecting simple quotes
  const tokens = trimmed.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
  if (tokens.length === 0) return true;

  // Clean the binary name (e.g. /usr/bin/ls -> ls)
  let binary = tokens[0].replace(/^["']|["']$/g, '');
  binary = binary.split('/').pop().toLowerCase();

  // Strip leading variable assignments like FOO=1 bar
  let tokenIdx = 0;
  while (binary.includes('=') && tokenIdx < tokens.length - 1) {
    tokenIdx++;
    binary = tokens[tokenIdx].replace(/^["']|["']$/g, '').split('/').pop().toLowerCase();
  }

  const args = tokens.slice(tokenIdx + 1).map(t => t.replace(/^["']|["']$/g, ''));

  // Handle wrappers like sudo, env, xargs, etc.
  if (binary === 'sudo' || binary === 'env' || binary === 'xargs') {
    if (args.length === 0) return true;
    return isSingleCommandReadOnly(args.join(' '));
  }

  // Handle docker compose with hyphen or space
  if (binary === 'docker' && args[0] === 'compose') {
    return isSubcommandReadOnly('docker-compose', args.slice(1));
  }

  if (binary === 'git' || binary === 'docker' || binary === 'docker-compose' || binary === 'orca') {
    return isSubcommandReadOnly(binary, args);
  }

  if (READ_ONLY_BINARIES.has(binary)) {
    return true;
  }

  return false;
}

function isEntireCommandReadOnly(fullCommandLine) {
  if (!fullCommandLine) return false;

  // Split by logical operators and pipes: &&, ||, ;, |
  // Note: Avoid splitting inside quotes by simple regex approximation or segmenting
  const segments = fullCommandLine.split(/&&|\|\||;|\|/);

  for (const seg of segments) {
    if (!isSingleCommandReadOnly(seg)) {
      return false;
    }
  }

  return true;
}

async function main() {
  const payload = await readStdin();
  const toolCall = payload.toolCall || {};
  const args = toolCall.args || {};
  const commandLine = args.CommandLine || args.commandLine || '';

  if (isEntireCommandReadOnly(commandLine)) {
    process.stdout.write(JSON.stringify({
      decision: 'allow',
      reason: `Comando de solo lectura verificado y aprobado automáticamente: ${commandLine}`
    }));
    return;
  }

  // Not strictly read-only: delegate to default user permission check
  process.stdout.write(JSON.stringify({
    decision: 'ask'
  }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'ask' }));
});
