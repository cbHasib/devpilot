'use strict';

const fs = require('fs');
const path = require('path');

const { STATE_DIR } = require('../constants');
const { readJsonSafe, titleCase } = require('../utils');
const { detectFramework, defaultPort } = require('./framework');

const IGNORED_DIRS = new Set([
  '.cache',
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  STATE_DIR
]);

const WORKSPACE_DIRS = ['apps', 'packages', 'services'];
const COMMON_SERVICE_DIRS = ['frontend', 'backend', 'admin', 'mobile', 'api', 'worker', 'landing'];
const scanCache = new Map();

function scanWorkspace(root) {
  const resolved = path.resolve(root);

  if (scanCache.has(resolved)) {
    return scanCache.get(resolved);
  }

  const packageCache = new Map();
  const rootEntries = readDir(resolved);
  const rootPackage = readPackageJson(resolved, packageCache);
  const services = serviceDirectories(resolved, rootEntries)
    .map((dir) => serviceFromDir(resolved, dir, packageCache))
    .filter(Boolean);
  const result = {
    root: resolved,
    rootEntries: rootEntries.map((entry) => entry.name),
    rootPackage,
    rootPackageExists: Boolean(rootPackage),
    rootEnvExists: hasEnvFile(resolved),
    services
  };

  scanCache.set(resolved, result);
  return result;
}

function serviceDirectories(root, rootEntries) {
  const found = [];
  const seen = new Set();

  rootEntries
    .filter((entry) => isCandidateDir(entry))
    .forEach((entry) => {
      const isCommon = COMMON_SERVICE_DIRS.includes(entry.name);
      const hasPackage = fs.existsSync(path.join(root, entry.name, 'package.json'));
      const isWorkspaceContainer = WORKSPACE_DIRS.includes(entry.name);

      if ((isCommon || hasPackage) && !isWorkspaceContainer) {
        pushDir(found, seen, entry.name);
      }
    });

  WORKSPACE_DIRS.forEach((workspaceDir) => {
    readDir(path.join(root, workspaceDir))
      .filter((entry) => isCandidateDir(entry))
      .forEach((entry) => pushDir(found, seen, path.join(workspaceDir, entry.name)));
  });

  return found;
}

function serviceFromDir(root, dir, packageCache) {
  const fullPath = path.join(root, dir);
  const packageJson = readPackageJson(fullPath, packageCache);

  if (!packageJson) {
    return null;
  }

  const files = readDir(fullPath).map((entry) => entry.name);
  const framework = detectFramework(packageJson, files);
  const scripts = packageJson.scripts || {};
  const devScript = scripts.dev || scripts['start:dev'] || scripts.start || '';
  const port = inferPort(fullPath, devScript, framework);

  return {
    dir,
    name: inferServiceName(packageJson, dir),
    packageName: String(packageJson.name || '').trim(),
    framework,
    port,
    hasEnv: hasEnvFile(fullPath),
    hasPackageJson: true,
    scripts
  };
}

function inferServiceName(packageJson, dir) {
  return titleCase(packageJson.name || path.basename(dir));
}

function inferPort(root, script, framework) {
  const fromEnv = envPort(root);

  if (fromEnv) {
    return fromEnv;
  }

  const fromScript = scriptPort(script);

  if (fromScript) {
    return fromScript;
  }

  return defaultPort(framework);
}

function envPort(root) {
  const files = ['.env', '.env.local'];

  for (const file of files) {
    const value = readEnvPort(path.join(root, file));

    if (value) {
      return value;
    }
  }

  return null;
}

function readEnvPort(file) {
  let content = '';

  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return null;
  }

  const match = content.match(/^(?:PORT|VITE_PORT|APP_PORT)\s*=\s*["']?(\d{2,5})/m);
  return match ? Number(match[1]) : null;
}

function scriptPort(script) {
  const value = String(script || '');
  const match = value.match(/(?:--port|-p)\s*=?\s*(\d{2,5})/) || value.match(/\bPORT\s*=\s*(\d{2,5})/);
  return match ? Number(match[1]) : null;
}

function hasEnvFile(root) {
  return fs.existsSync(path.join(root, '.env')) || fs.existsSync(path.join(root, '.env.local'));
}

function readPackageJson(root, cache) {
  const file = path.join(root, 'package.json');

  if (!cache.has(file)) {
    cache.set(file, readJsonSafe(file));
  }

  return cache.get(file);
}

function readDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

function isCandidateDir(entry) {
  return entry.isDirectory() && !entry.name.startsWith('.') && !IGNORED_DIRS.has(entry.name);
}

function pushDir(found, seen, dir) {
  if (seen.has(dir)) {
    return;
  }

  seen.add(dir);
  found.push(dir);
}

module.exports = {
  COMMON_SERVICE_DIRS,
  IGNORED_DIRS,
  WORKSPACE_DIRS,
  scanWorkspace
};
