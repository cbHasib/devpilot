'use strict';

const { header, section, line, paint } = require('../ui');
const { success, warning } = require('../logger');
const { stopService } = require('../runtime/processManager');

async function stopServices(context, args = []) {
  const services = targetServices(context, args[0]);

  header(context.config);
  section('Stop Services');

  if (services.length === 0) {
    warning(`No matching service found for ${args[0] || 'workspace'}.`);
    return;
  }

  for (const service of services) {
    const result = await stopService(context, service);

    if (result.stopped) {
      success(`${service.name} stopped`);
    } else if (result.reason === 'signal-failed') {
      warning(`${service.name} could not be stopped from this terminal.`);
    } else {
      line(`  ${paint('•', 'gray')} ${service.name} was not running`);
    }
  }
}

function targetServices(context, target) {
  const services = context.config.services || [];

  if (!target) {
    return services;
  }

  const normalized = String(target).toLowerCase();
  return services.filter((service) => (
    service.name.toLowerCase() === normalized
      || service.dir.toLowerCase() === normalized
      || service.dir.toLowerCase().endsWith(`/${normalized}`)
  ));
}

module.exports = { stopServices, targetServices };
