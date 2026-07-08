'use strict';

const { header, section } = require('../ui');
const { warning } = require('../logger');
const { followLogs, followWorkspaceLogs } = require('../runtime/logs');
const { targetServices } = require('./stop');

async function showLogs(context, args = []) {
  const target = args[0];
  const services = targetServices(context, target);

  header(context.config);
  section(target ? `Logs: ${target}` : 'Workspace Logs');

  if (services.length === 0) {
    warning(`No matching service found for ${target || 'workspace'}.`);
    return;
  }

  if (target) {
    await followLogs(context, services[0]);
    return;
  }

  await followWorkspaceLogs(context, services);
}

module.exports = { showLogs };
