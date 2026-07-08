'use strict';

const { SUPPORTED_PACKAGE_MANAGERS } = require('./constants');
const { detectPackageManagerInfo: detectPackageManagerInfoFromWorkspace } = require('./workspace/detector');
const { scanWorkspace } = require('./workspace/scanner');

function cleanService(service) {
  const clean: any = {
    dir: String(service.dir || '').trim(),
    name: String(service.name || '').trim(),
    dev: String(service.dev || '').trim(),
    build: String(service.build || '').trim(),
    lint: String(service.lint || '').trim(),
    color: String(service.color || '').trim(),
    framework: String(service.framework || '').trim(),
    port: normalizePort(service.port)
  };

  const dependsOn = normalizeDependsOn(service.dependsOn);
  const delay = normalizeDelay(service.delay);

  if (dependsOn.length > 0) {
    clean.dependsOn = dependsOn;
  }

  if (delay > 0) {
    clean.delay = delay;
  }

  return clean;
}

function detectServices(root, packageManager) {
  return scanWorkspace(root).services.map((service) => serviceFromScan(service, packageManager));
}

function serviceFromScan(service, packageManager) {
  const scripts = service.scripts || {};

  return cleanService({
    dir: service.dir,
    name: service.name,
    dev: inferScript(packageManager, scripts, ['start:dev', 'dev', 'start']),
    build: inferScript(packageManager, scripts, ['build']),
    lint: inferScript(packageManager, scripts, ['lint']),
    framework: service.framework,
    port: service.port
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
  return detectPackageManagerInfoFromWorkspace(root);
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

function normalizePort(port) {
  const value = Number(port);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeDependsOn(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeDelay(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

module.exports = {
  cleanService,
  detectServices,
  serviceFromScan,
  detectPackageManagerInfo,
  inferScript,
  scriptCommand,
  detectPackageManager,
  installCommand,
  isSupportedPackageManager
};
