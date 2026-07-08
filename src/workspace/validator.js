'use strict';

const fs = require('fs');
const path = require('path');

const { CONFIG_FILE, SUPPORTED_PACKAGE_MANAGERS } = require('../constants');
const { isGitRepo, servicePath } = require('../utils');
const { scanWorkspace } = require('./scanner');
const { findService, listProfiles, normalizeHooks, tokenKey } = require('../profiles/manager');
const { normalizeDelay, normalizeDependsOn, startupBatches } = require('../profiles/dependencies');

const COMMAND_FIELDS = ['dev', 'build', 'lint'];

function validateConfig(context, options = {}) {
  const config = context.config || {};
  const services = Array.isArray(config.services) ? config.services : [];
  const allServices = Array.isArray(context.allServices) ? context.allServices : services;
  const scan = scanWorkspace(context.root);
  const warnings = [];

  if (config._configError) {
    warnings.push(warning(
      'config.parse',
      `${CONFIG_FILE} could not be parsed: ${config._configError}`,
      `Fix ${CONFIG_FILE} or run devpilot setup to regenerate it.`
    ));
  }

  if (config.schemaVersion !== 1) {
    warnings.push(warning(
      'config.schema',
      `Unsupported schema version: ${config.schemaVersion || 'not set'}.`,
      'Run devpilot setup to refresh the local configuration.'
    ));
  }

  if (!config.alias) {
    warnings.push(warning(
      'config.alias',
      'Alias is missing from the configuration.',
      'Run devpilot setup to choose an alias.'
    ));
  }

  if (!SUPPORTED_PACKAGE_MANAGERS.includes(config.packageManager)) {
    warnings.push(warning(
      'config.packageManager',
      `Unsupported package manager: ${config.packageManager || 'not set'}.`,
      `Use one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}.`
    ));
  }

  if (!scan.rootPackageExists) {
    warnings.push(warning(
      'workspace.packageJson',
      'Workspace root has no package.json.',
      'Add a root package.json if this is a Node workspace.'
    ));
  }

  if (!scan.rootEnvExists) {
    warnings.push(warning(
      'workspace.env',
      'Workspace root has no .env file.',
      'Add .env or .env.local if this project requires environment variables.'
    ));
  }

  if (!isGitRepo(context.root)) {
    warnings.push(warning(
      'workspace.git',
      'Git repository not initialized.',
      'Run git init if this workspace should be updated through Git.'
    ));
  }

  duplicateServiceNames(services).forEach((name) => {
    warnings.push(warning(
      'services.duplicateName',
      `Duplicate service name: ${name}.`,
      `Rename one service in ${CONFIG_FILE} so menu labels stay unique.`
    ));
  });

  services.forEach((service) => {
    warnings.push(...serviceWarnings(context, service, options));
  });

  warnings.push(...profileWarnings(config, allServices));
  warnings.push(...dependencyWarnings(context, allServices));
  warnings.push(...hookWarnings(config));

  return warnings;
}

function serviceWarnings(context, service, options = {}) {
  const warnings = [];
  const root = servicePath(context, service);
  const label = service.name || service.dir || 'Unnamed service';
  const dir = service.dir || label;

  if (!service.dir) {
    warnings.push(warning(
      'service.path',
      `${label} has no service directory configured.`,
      `Set "dir" for this service in ${CONFIG_FILE}.`
    ));
    return warnings;
  }

  if (!fs.existsSync(root)) {
    warnings.push(warning(
      'service.path',
      `${dir}/ directory is missing.`,
      'Check your configuration or run devpilot setup.'
    ));
    return warnings;
  }

  if (!fs.existsSync(path.join(root, 'package.json'))) {
    warnings.push(warning(
      'service.packageJson',
      `${dir} has no package.json.`,
      `Add package.json to ${dir}/ or remove it from ${CONFIG_FILE}.`
    ));
  }

  COMMAND_FIELDS.forEach((field) => {
    const command = service[field];

    if (isInvalidCommand(command)) {
      warnings.push(warning(
        'service.command',
        `${label} ${field} command is invalid.`,
        `Use a single-line command in ${CONFIG_FILE}.`
      ));
      return;
    }

    if (options.includeMissingCommands && !command) {
      warnings.push(warning(
        'service.command',
        `${label} ${field} command is missing.`,
        `Add a ${field} command or leave it empty if this service should be skipped.`
      ));
    }
  });

  normalizeDependsOn(service.dependsOn).forEach((dependency) => {
    const dependencyServices = context.allServices || context.config.services || [];

    if (!findService(dependencyServices, dependency)) {
      warnings.push(warning(
        'service.dependency',
        `${label} depends on missing service "${dependency}".`,
        `Update "dependsOn" for ${label} in ${CONFIG_FILE}.`
      ));
    }
  });

  if (service.delay !== undefined && normalizeDelay(service.delay) === 0 && Number(service.delay) !== 0) {
    warnings.push(warning(
      'service.delay',
      `${label} startup delay is invalid.`,
      `Use a positive number of milliseconds for "delay" in ${CONFIG_FILE}.`
    ));
  }

  return warnings;
}

function serviceExecutionIssue(context, service, field) {
  const root = servicePath(context, service);
  const label = service.name || service.dir || 'Unnamed service';
  const command = service[field];

  if (!service.dir || !fs.existsSync(root)) {
    return warning(
      'service.path',
      `Cannot find ${service.dir || label}/.`,
      'Check your configuration or run devpilot setup.'
    );
  }

  if (isInvalidCommand(command)) {
    return warning(
      'service.command',
      `${label} ${field} command is invalid.`,
      `Use a single-line command in ${CONFIG_FILE}.`
    );
  }

  return null;
}

function serviceExecutionWarnings(context, service) {
  const root = servicePath(context, service);

  if (!service.dir || !fs.existsSync(root) || fs.existsSync(path.join(root, 'package.json'))) {
    return [];
  }

  return [warning(
    'service.packageJson',
    `${service.dir} has no package.json.`,
    `Add package.json to ${service.dir}/ or remove it from ${CONFIG_FILE}.`
  )];
}

function duplicateServiceNames(services) {
  const seen = new Map();
  const duplicates = new Set();

  services.forEach((service) => {
    const name = String(service.name || '').trim();

    if (!name) {
      return;
    }

    const key = name.toLowerCase();

    if (seen.has(key)) {
      duplicates.add(name);
      return;
    }

    seen.set(key, name);
  });

  return [...duplicates];
}

function profileWarnings(config, services) {
  const warnings = [];
  const seen = new Map();

  listProfiles(config).forEach((profile) => {
    const key = tokenKey(profile.name || profile.id);

    if (seen.has(key)) {
      warnings.push(warning(
        'profiles.duplicateName',
        `Duplicate profile name: ${profile.name}.`,
        `Rename one profile in ${CONFIG_FILE} so command matching stays clear.`
      ));
    } else {
      seen.set(key, profile.name);
    }

    profile.services
      .filter((token) => token !== '*')
      .forEach((token) => {
        if (!findService(services, token)) {
          warnings.push(warning(
            'profiles.service',
            `Profile "${profile.name}" references missing service "${token}".`,
            `Update the "profiles" section in ${CONFIG_FILE}.`
          ));
        }
      });
  });

  return warnings;
}

function dependencyWarnings(context, services) {
  const plan = startupBatches({ ...context, allServices: services }, services);
  const unique = new Set();

  return plan.warnings
    .filter((message) => !message.includes('depends on missing service'))
    .filter((message) => {
      if (unique.has(message)) {
        return false;
      }

      unique.add(message);
      return true;
    })
    .map((message) => warning(
      'service.dependency',
      message,
      `Update "dependsOn" entries in ${CONFIG_FILE}.`
    ));
}

function hookWarnings(config) {
  const hooks = normalizeHooks(config.hooks);
  const warnings = [];

  Object.keys(hooks).forEach((name) => {
    hooks[name].forEach((command) => {
      if (isInvalidCommand(command)) {
        warnings.push(warning(
          'hooks.command',
          `Hook "${name}" contains an invalid command.`,
          `Use single-line hook commands in ${CONFIG_FILE}.`
        ));
      }
    });
  });

  return warnings;
}

function isInvalidCommand(command) {
  return typeof command === 'string' && /[\r\n]/.test(command);
}

function warning(code, message, guidance) {
  return { code, message, guidance, severity: 'warning' };
}

module.exports = {
  validateConfig,
  serviceExecutionIssue,
  serviceExecutionWarnings,
  isInvalidCommand
};
