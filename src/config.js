'use strict';

const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const { CONFIG_FILE, STATE_DIR } = require('./constants');
const { defaultAlias, readJson, titleCase } = require('./utils');
const { cleanService, detectPackageManager } = require('./services');
const { scanWorkspace } = require('./workspace/scanner');
const { normalizeHooks, normalizeProfiles } = require('./profiles/manager');

function loadProjectContext(startDir) {
  const resolved = path.resolve(startDir);
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  const root = stat && stat.isFile() ? path.dirname(resolved) : findConfigRoot(resolved);

  if (!root) {
    return null;
  }

  const configPath = path.join(root, CONFIG_FILE);
  let config = {};
  let configError = null;

  try {
    config = readJson(configPath);
  } catch (error) {
    configError = error;
  }

  return {
    root,
    configPath,
    config: normalizeConfig(config, root, configError)
  };
}

function findConfigRoot(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, CONFIG_FILE))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function writeConfig(root, config) {
  const file = path.join(root, CONFIG_FILE);
  const now = new Date().toISOString();
  const next = normalizeConfig(config, root);

  next.createdAt = next.createdAt || now;
  next.lastUpdated = now;
  next.devpilotVersion = pkg.version;
  delete next._configError;
  delete next.activeProfile;

  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}

function normalizeConfig(config, root, configError = null) {
  const source = config && typeof config === 'object' ? config : {};
  const projectName = stringValue(source.projectName) || titleCase(path.basename(root));
  const packageManager = stringValue(source.packageManager) || detectPackageManager(root);
  const services = enrichServices(
    Array.isArray(source.services) ? source.services.map(cleanService) : [],
    root
  );

  return {
    ...source,
    schemaVersion: source.schemaVersion || 1,
    projectName,
    alias: stringValue(source.alias) || defaultAlias(projectName || path.basename(root)),
    packageManager,
    launchMode: source.launchMode === 'current' ? 'current' : 'tabs',
    editor: stringValue(source.editor) || 'code',
    services,
    createdAt: stringValue(source.createdAt),
    lastUpdated: stringValue(source.lastUpdated),
    devpilotVersion: stringValue(source.devpilotVersion) || pkg.version,
    workspace: normalizeWorkspace(source.workspace),
    features: objectValue(source.features),
    profiles: normalizeProfiles(source.profiles),
    hooks: normalizeHooks(source.hooks),
    activeProfile: undefined,
    _configError: configError ? configError.message : null
  };
}

function enrichServices(services, root) {
  const detected = new Map(scanWorkspace(root).services.map((service) => [service.dir, service]));

  return services.map((service) => {
    const match = detected.get(service.dir);

    if (!match) {
      return service;
    }

    return {
      ...service,
      framework: service.framework || match.framework || '',
      port: service.port || match.port || null
    };
  });
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeWorkspace(value) {
  const source = objectValue(value);

  return {
    type: stringValue(source.type),
    id: stringValue(source.id),
    source: stringValue(source.source),
    monorepo: Boolean(source.monorepo)
  };
}

function ensureGitignore(root) {
  const gitignorePath = path.join(root, '.gitignore');
  const entries = [CONFIG_FILE, `${STATE_DIR}/`];
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const existingLines = new Set(content.split(/\r?\n/).map((lineValue) => lineValue.trim()));
  const missing = entries.filter((entry) => !existingLines.has(entry));

  if (missing.length === 0) {
    return;
  }

  if (content && !content.endsWith('\n')) {
    content += '\n';
  }

  if (!existingLines.has('# DevPilot local config')) {
    content += '\n# DevPilot local config\n';
  }

  content += `${missing.join('\n')}\n`;
  fs.writeFileSync(gitignorePath, content);
}

module.exports = {
  loadProjectContext,
  findConfigRoot,
  writeConfig,
  ensureGitignore,
  normalizeConfig
};
