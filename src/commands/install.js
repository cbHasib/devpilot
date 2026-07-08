'use strict';

const { header, completionBanner, countLabel } = require('../ui');
const { info, warning } = require('../logger');
const { installCommand, isSupportedPackageManager } = require('../services');
const { runSequential } = require('./tasks');

async function installAll(context) {
  header(context.config);
  await installServices(context);
}

async function installServices(context, options = {}) {
  const services = context.config.services;

  if (services.length === 0) {
    warning('No services are configured.');
    return 0;
  }

  const command = installCommand(context.config.packageManager);

  if (!isSupportedPackageManager(context.config.packageManager)) {
    warning(`Unsupported package manager: ${context.config.packageManager || 'not set'}.`);
    info('Falling back to yarn install. Run devpilot setup to choose a supported package manager.');
  }

  const completed = await runSequential(context, services, command, 'Install Dependencies');

  if (completed === 0) {
    warning('No runnable services found.');
    return 0;
  }

  if (options.showCompletion !== false) {
    completionBanner(`Dependencies installed for ${countLabel(completed)}`);
  }

  return completed;
}

module.exports = { installAll, installServices };
