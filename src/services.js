'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR } = require('./constants');
const { readJson, titleCase } = require('./utils');

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
  const ignored = new Set([
    '.git',
    '.next',
    '.turbo',
    'coverage',
    'dist',
    'node_modules',
    STATE_DIR
  ]);

  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ignored.has(entry.name))
    .map((entry) => {
      const packagePath = path.join(root, entry.name, 'package.json');

      if (!fs.existsSync(packagePath)) {
        return null;
      }

      const packageJson = readJson(packagePath);
      const scripts = packageJson.scripts || {};

      return cleanService({
        dir: entry.name,
        name: titleCase(packageJson.name || entry.name),
        dev: inferScript(packageManager, scripts, ['start:dev', 'dev', 'start']),
        build: inferScript(packageManager, scripts, ['build']),
        lint: inferScript(packageManager, scripts, ['lint'])
      });
    })
    .filter(Boolean);
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
  if (fs.existsSync(path.join(root, 'yarn.lock'))) {
    return 'yarn';
  }

  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) {
    return 'bun';
  }

  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    return 'npm';
  }

  return 'yarn';
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

module.exports = {
  cleanService,
  detectServices,
  inferScript,
  scriptCommand,
  detectPackageManager,
  installCommand
};
