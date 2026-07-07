'use strict';

const { header, section, line, paint, warning, completionBanner, countLabel } = require('../ui');
const { runShell, servicePath } = require('../utils');

async function runForServices(context, field, title) {
  const services = context.config.services.filter((service) => service[field]);
  header(context.config);

  if (services.length === 0) {
    warning(`No services have a ${field} command configured.`);
    return;
  }

  for (const service of services) {
    await runOne(context, service, service[field], title);
  }

  completionBanner(`${title} finished for ${countLabel(services.length)}`);
}

async function runSequential(context, services, command, title) {
  for (const service of services) {
    await runOne(context, service, command, title);
  }
}

async function runOne(context, service, command, title) {
  section(`${title}: ${service.name}`);
  line(`    ${paint('folder', 'dim')}   ${service.dir}`);
  line(`    ${paint('command', 'dim')}  ${paint(command, 'cyan')}`);
  line();
  await runShell(command, servicePath(context, service));
}

module.exports = { runForServices, runSequential };
