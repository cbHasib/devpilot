'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR, SUPPORTED_PACKAGE_MANAGERS } = require('./constants');
const { readJsonSafe, titleCase } = require('./utils');

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  STATE_DIR
]);

const WORKSPACE_DIRS = ['apps', 'packages', 'services'];

function cleanService(service) {
  return {
    dir: String(service.dir || '').trim(),
    name: String(service.name || '').trim(),
    dev: String(service.dev || '').trim(),
    build: String(service.build || '').trim(),
    lint: String(service.lint || '').trim(),
    color: String(service.color || '').trim()
  };
}

function detectServices(root, packageManager) {
  return serviceDirectories(root)
    .map((dir) => packageService(root, dir, packageManager))
    .filter(Boolean);
}

function serviceDirectories(root) {
  const found = [];
  const seen = new Set();

  addChildDirectories(root, '', found, seen);

  WORKSPACE_DIRS.forEach((workspaceDir) => {
    addChildDirectories(path.join(root, workspaceDir), workspaceDir, found, seen);
  });

  return found;
}

function addChildDirectories(parent, prefix, found, seen) {
  let entries = [];

  try {
    entries = fs.readdirSync(parent, { withFileTypes: true });
  } catch (error) {
    return;
  }

  entries
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
    .forEach((entry) => {
      const dir = prefix ? path.join(prefix, entry.name) : entry.name;

      if (!seen.has(dir)) {
        seen.add(dir);
        found.push(dir);
      }
    });
}

function packageService(root, dir, packageManager) {
  const packageJson = readJsonSafe(path.join(root, dir, 'package.json'));

  if (!packageJson) {
    return null;
  }

  const scripts = packageJson.scripts || {};

  return cleanService({
    dir,
    name: titleCase(packageJson.name || path.basename(dir)),
    dev: inferScript(packageManager, scripts, ['start:dev', 'dev', 'start']),
    build: inferScript(packageManager, scripts, ['build']),
    lint: inferScript(packageManager, scripts, ['lint'])
  });
}

function inferScript(packageManager, scripts, candidates) {
  const script = candidates.find((candidate) => scripts[candidate]);
  return script ? scriptCommand(packageManager, script) : '';
}

function scriptCommand(packageManager, script) {
  if (!script) {
    return '';
  }

  if (packageManager === 'npm') {
    return `npm run ${script}`;
  }

  if (packageManager === 'bun') {
    return `bun run ${script}`;
  }

  return `${packageManager} ${script}`;
}

function detectPackageManager(root) {
  return detectPackageManagerInfo(root).value;
}

function detectPackageManagerInfo(root) {
  if (fs.existsSync(path.join(root, 'yarn.lock'))) {
    return { value: 'yarn', detected: true, source: 'yarn.lock' };
  }

  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
    return { value: 'pnpm', detected: true, source: 'pnpm-lock.yaml' };
  }

  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) {
    return { value: 'bun', detected: true, source: 'bun.lock' };
  }

  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    return { value: 'npm', detected: true, source: 'package-lock.json' };
  }

  return { value: 'yarn', detected: false, source: null };
}

function installCommand(packageManager) {
  if (packageManager === 'npm') {
    return 'npm install';
  }

  if (packageManager === 'pnpm') {
    return 'pnpm install';
  }

  if (packageManager === 'bun') {
    return 'bun install';
  }

  return 'yarn install';
}

function isSupportedPackageManager(packageManager) {
  return SUPPORTED_PACKAGE_MANAGERS.includes(packageManager);
}

module.exports = {
  cleanService,
  detectServices,
  detectPackageManagerInfo,
  inferScript,
  scriptCommand,
  detectPackageManager,
  installCommand,
  isSupportedPackageManager
};
