'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR } = require('../constants');
const { readJsonSafe } = require('../utils');

const RUNTIME_DIR = 'runtime';
const LOGS_DIR = 'logs';
const REGISTRY_FILE = 'registry.json';

function ensureRuntime(root) {
  const runtime = runtimeDir(root);
  fs.mkdirSync(logsDir(root), { recursive: true });
  ensureRuntimeIgnored(root);
  return runtime;
}

function readRegistry(root) {
  ensureRuntime(root);
  const data = readJsonSafe(registryPath(root)) || {};
  const registry = {
    schemaVersion: 1,
    services: data.services && typeof data.services === 'object' ? data.services : {}
  };

  return cleanStale(root, registry);
}

function writeRegistry(root, registry) {
  ensureRuntime(root);
  fs.writeFileSync(registryPath(root), `${JSON.stringify(registry, null, 2)}\n`);
}

function upsertEntry(root, entry) {
  const registry = readRegistry(root);
  registry.services[entry.key] = {
    ...(registry.services[entry.key] || {}),
    ...entry,
    updatedAt: new Date().toISOString()
  };
  writeRegistry(root, registry);
  return registry.services[entry.key];
}

function updateEntry(root, key, patch) {
  const registry = readRegistry(root);

  if (!registry.services[key]) {
    return null;
  }

  registry.services[key] = {
    ...registry.services[key],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeRegistry(root, registry);
  return registry.services[key];
}

function entries(root) {
  return Object.values(readRegistry(root).services);
}

function entryForService(root, service) {
  return readRegistry(root).services[serviceKey(service)] || null;
}

function serviceKey(service) {
  return String(service.dir || service.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'service';
}

function logPath(root, service) {
  return path.join(logsDir(root), `${serviceKey(service)}.log`);
}

function runtimeDir(root) {
  return path.join(root, STATE_DIR, RUNTIME_DIR);
}

function logsDir(root) {
  return path.join(runtimeDir(root), LOGS_DIR);
}

function registryPath(root) {
  return path.join(runtimeDir(root), REGISTRY_FILE);
}

function processAlive(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') {
      return true;
    }

    return false;
  }
}

function cleanStale(root, registry) {
  let changed = false;

  Object.keys(registry.services).forEach((key) => {
    const entry = registry.services[key];

    if (entry.pid && entry.status === 'running' && !processAlive(entry.pid)) {
      registry.services[key] = {
        ...entry,
        status: entry.exitCode && entry.exitCode !== 0 ? 'failed' : 'exited',
        stoppedAt: entry.stoppedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      changed = true;
    }
  });

  if (changed) {
    writeRegistry(root, registry);
  }

  return registry;
}

function ensureRuntimeIgnored(root) {
  const gitignore = path.join(root, '.gitignore');
  const entry = `${STATE_DIR}/`;
  let content = '';

  try {
    content = fs.readFileSync(gitignore, 'utf8');
  } catch (error) {
    content = '';
  }

  const lines = new Set(content.split(/\r?\n/).map((lineValue) => lineValue.trim()));

  if (lines.has(entry)) {
    return;
  }

  if (content && !content.endsWith('\n')) {
    content += '\n';
  }

  content += `\n# DevPilot local runtime\n${entry}\n`;
  fs.writeFileSync(gitignore, content);
}

module.exports = {
  entries,
  ensureRuntime,
  entryForService,
  logPath,
  processAlive,
  readRegistry,
  serviceKey,
  updateEntry,
  upsertEntry,
  writeRegistry
};
