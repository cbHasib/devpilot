'use strict';

const { header, section } = require('../ui');
const { success, warning } = require('../logger');
const { restartService } = require('../runtime/processManager');
const { targetServices } = require('./stop');

async function restartServices(context, args = []) {
  const services = targetServices(context, args[0]).filter((service) => service.dev);

  header(context.config);
  section('Restart Services');

  if (services.length === 0) {
    warning(`No runnable service found for ${args[0] || 'workspace'}.`);
    return;
  }

  for (const service of services) {
    await restartService(context, service);
    success(`${service.name} restarted`);
  }
}

module.exports = { restartServices };
