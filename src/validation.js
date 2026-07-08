'use strict';

const fs = require('fs');
const path = require('path');

const { CONFIG_FILE, SUPPORTED_PACKAGE_MANAGERS } = require('./constants');
const { servicePath } = require('./utils');

const COMMAND_FIELDS = ['dev', 'build', 'lint'];

function validateConfig(context, options = {}) {
  const config = context.config || {};
  const services = Array.isArray(config.services) ? config.services : [];
  const warnings = [];

  if (config._configError) {
    warnings.push({
      message: `${CONFIG_FILE} could not be parsed: ${config._configError}`,
      guidance: `Fix ${CONFIG_FILE} or run devpilot setup to regenerate it.`
    });
  }

  if (!config.alias) {
    warnings.push({
      message: 'Alias is missing from the configuration.',
      guidance: 'Run devpilot setup to choose an alias.'
    });
  }

  if (!SUPPORTED_PACKAGE_MANAGERS.includes(config.packageManager)) {
    warnings.push({
      message: `Unsupported package manager: ${config.packageManager || 'not set'}.`,
      guidance: `Use one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}.`
    });
  }

  duplicateServiceNames(services).forEach((name) => {
    warnings.push({
      message: `Duplicate service name: ${name}.`,
      guidance: `Rename one service in ${CONFIG_FILE} so menu labels stay unique.`
    });
  });

  services.forEach((service) => {
    warnings.push(...serviceWarnings(context, service, options));
  });

  return warnings;
}

function serviceWarnings(context, service, options = {}) {
  const warnings = [];
  const root = servicePath(context, service);
  const label = service.name || service.dir || 'Unnamed service';
  const dir = service.dir || label;

  if (!service.dir) {
    warnings.push({
      message: `${label} has no service directory configured.`,
      guidance: `Set "dir" for this service in ${CONFIG_FILE}.`
    });
    return warnings;
  }

  if (!fs.existsSync(root)) {
    warnings.push({
      message: `${dir}/ directory is missing.`,
      guidance: `Check your configuration or run devpilot setup.`
    });
    return warnings;
  }

  if (!fs.existsSync(path.join(root, 'package.json'))) {
    warnings.push({
      message: `${dir} has no package.json.`,
      guidance: `Add package.json to ${dir}/ or remove it from ${CONFIG_FILE}.`
    });
  }

  COMMAND_FIELDS.forEach((field) => {
    const command = service[field];

    if (isInvalidCommand(command)) {
      warnings.push({
        message: `${label} ${field} command is invalid.`,
        guidance: `Use a single-line command in ${CONFIG_FILE}.`
      });
      return;
    }

    if (options.includeMissingCommands && !command) {
      warnings.push({
        message: `${label} ${field} command is missing.`,
        guidance: `Add a ${field} command or leave it empty if this service should be skipped.`
      });
    }
  });

  return warnings;
}

function serviceExecutionIssue(context, service, field) {
  const root = servicePath(context, service);
  const label = service.name || service.dir || 'Unnamed service';
  const command = service[field];

  if (!service.dir || !fs.existsSync(root)) {
    return {
      message: `Cannot find ${service.dir || label}/.`,
      guidance: `Check your configuration or run devpilot setup.`
    };
  }

  if (isInvalidCommand(command)) {
    return {
      message: `${label} ${field} command is invalid.`,
      guidance: `Use a single-line command in ${CONFIG_FILE}.`
    };
  }

  return null;
}

function serviceExecutionWarnings(context, service) {
  const root = servicePath(context, service);

  if (!service.dir || !fs.existsSync(root) || fs.existsSync(path.join(root, 'package.json'))) {
    return [];
  }

  return [{
    message: `${service.dir} has no package.json.`,
    guidance: `Add package.json to ${service.dir}/ or remove it from ${CONFIG_FILE}.`
  }];
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

function isInvalidCommand(command) {
  return typeof command === 'string' && /[\r\n]/.test(command);
}

module.exports = {
  validateConfig,
  serviceExecutionIssue,
  serviceExecutionWarnings,
  isInvalidCommand
};
