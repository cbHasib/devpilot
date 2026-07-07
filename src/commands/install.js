'use strict';

const { header, warning, completionBanner, countLabel } = require('../ui');
const { installCommand } = require('../services');
const { runSequential } = require('./tasks');

async function installAll(context) {
  header(context.config);
  await installServices(context);
}

async function installServices(context) {
  const services = context.config.services;

  if (services.length === 0) {
    warning('No services are configured.');
    return;
  }

  const command = installCommand(context.config.packageManager);
  await runSequential(context, services, command, 'Install Dependencies');
  completionBanner(`Dependencies installed for ${countLabel(services.length)}`);
}

module.exports = { installAll, installServices };
