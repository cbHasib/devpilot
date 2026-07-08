'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

function runShell(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command}\nRun devpilot doctor to check your workspace configuration.`));
    });
  });
}

function servicePath(context, service) {
  return path.resolve(context.root, service.dir);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch (error) {
    return null;
  }
}

function titleCase(value) {
  return String(value)
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultAlias(value) {
  const alias = String(value)
    .toLowerCase()
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return alias || 'project';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function appleQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function winQuote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [command], { stdio: 'ignore' });
  return result.status === 0;
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.error || result.status !== 0) {
    return null;
  }

  return (result.stdout || result.stderr || '').trim();
}

function packageManagerLabel(packageManager) {
  const value = String(packageManager || '').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Package manager';
}

function isWsl() {
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch (error) {
    return false;
  }
}

function isGitRepo(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  return result.status === 0 && result.stdout.trim() === 'true';
}

function platformLabel() {
  if (process.platform === 'darwin') {
    return 'macOS';
  }

  if (process.platform === 'win32') {
    return 'Windows';
  }

  if (process.platform === 'linux') {
    return isWsl() ? 'Linux (WSL)' : 'Linux';
  }

  return process.platform;
}

function detectTerminal() {
  const env = process.env;

  if (env.WARP_IS_LOCAL_SHELL_SESSION) {
    return { name: 'Warp', supportsTabs: process.platform === 'darwin' };
  }

  if (env.TERM_PROGRAM === 'iTerm.app') {
    return { name: 'iTerm2', supportsTabs: process.platform === 'darwin' };
  }

  if (env.TERM_PROGRAM === 'Apple_Terminal') {
    return { name: 'Terminal', supportsTabs: process.platform === 'darwin' };
  }

  if (env.WT_SESSION) {
    return { name: 'Windows Terminal', supportsTabs: process.platform === 'win32' };
  }

  if (env.KONSOLE_VERSION) {
    return { name: 'Konsole', supportsTabs: process.platform === 'linux' && !isWsl() };
  }

  if (env.GNOME_TERMINAL_SCREEN || env.GNOME_TERMINAL_SERVICE) {
    return { name: 'GNOME Terminal', supportsTabs: process.platform === 'linux' && !isWsl() };
  }

  if (process.platform === 'win32') {
    return { name: env.PSModulePath ? 'PowerShell' : 'Windows console', supportsTabs: false };
  }

  return { name: env.TERM_PROGRAM || env.TERM || 'Unknown terminal', supportsTabs: false };
}

function detectLaunchMode() {
  if (process.platform === 'darwin' && commandExists('osascript')) {
    return 'tabs';
  }

  if (process.platform === 'linux' && !isWsl() && (commandExists('gnome-terminal') || commandExists('konsole'))) {
    return 'tabs';
  }

  if (process.platform === 'win32') {
    return 'tabs';
  }

  return 'current';
}

module.exports = {
  runShell,
  servicePath,
  readJson,
  readJsonSafe,
  titleCase,
  defaultAlias,
  shellQuote,
  appleQuote,
  winQuote,
  commandExists,
  commandOutput,
  packageManagerLabel,
  isWsl,
  isGitRepo,
  platformLabel,
  detectTerminal,
  detectLaunchMode
};
