'use strict';

const fs = require('fs');
const path = require('path');

const { isGitRepo } = require('../utils');
const { scanWorkspace } = require('./scanner');

const detectionCache = new Map();

function detectWorkspace(root) {
  const resolved = path.resolve(root);

  if (detectionCache.has(resolved)) {
    return detectionCache.get(resolved);
  }

  const scan = scanWorkspace(resolved);
  const packageManager = detectPackageManagerInfo(resolved);
  const workspace = detectWorkspaceType(resolved, scan.rootPackage);
  const result = {
    root: resolved,
    packageManager,
    git: {
      initialized: isGitRepo(resolved)
    },
    monorepo: workspace.monorepo || scan.services.length > 1,
    workspace,
    services: scan.services,
    rootPackageExists: scan.rootPackageExists,
    rootEnvExists: scan.rootEnvExists
  };

  detectionCache.set(resolved, result);
  return result;
}

function detectPackageManagerInfo(root) {
  const lockfiles = [
    ['yarn', 'yarn.lock'],
    ['pnpm', 'pnpm-lock.yaml'],
    ['bun', 'bun.lockb'],
    ['bun', 'bun.lock'],
    ['npm', 'package-lock.json']
  ];
  const match = lockfiles.find(([, file]) => fs.existsSync(path.join(root, file)));

  if (match) {
    return { value: match[0], detected: true, source: match[1] };
  }

  return { value: 'yarn', detected: false, source: null };
}

function detectWorkspaceType(root, packageJson) {
  const indicators = [
    ['Turborepo', 'turbo', 'turbo.json'],
    ['Nx', 'nx', 'nx.json'],
    ['pnpm workspace', 'pnpm-workspace', 'pnpm-workspace.yaml'],
    ['Lerna', 'lerna', 'lerna.json']
  ];
  const match = indicators.find(([, , file]) => fs.existsSync(path.join(root, file)));

  if (match) {
    return {
      type: match[0],
      id: match[1],
      source: match[2],
      monorepo: true
    };
  }

  if (packageJson && packageJson.workspaces) {
    return {
      type: 'package.json workspaces',
      id: 'package-workspaces',
      source: 'package.json',
      monorepo: true
    };
  }

  return {
    type: 'Multi-service workspace',
    id: 'multi-service',
    source: null,
    monorepo: false
  };
}

module.exports = {
  detectWorkspace,
  detectPackageManagerInfo,
  detectWorkspaceType
};
