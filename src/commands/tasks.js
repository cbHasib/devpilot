'use strict';

const { header, section, line, paint, completionBanner, countLabel } = require('../ui');
const { info, warning } = require('../logger');
const { runShell, servicePath } = require('../utils');
const { serviceExecutionIssue, serviceExecutionWarnings } = require('../validation');

async function runForServices(context, field, title) {
  const services = context.config.services.filter((service) => service[field]);
  header(context.config);

  if (services.length === 0) {
    warning(`No services have a ${field} command configured.`);
    return;
  }

  let completed = 0;

  for (const service of services) {
    if (await runOne(context, service, service[field], title, field)) {
      completed += 1;
    }
  }

  if (completed === 0) {
    warning('No runnable services found.');
    info('Check your configuration or run devpilot setup.');
    return;
  }

  completionBanner(`${title} finished for ${countLabel(completed)}`);
}

async function runSequential(context, services, command, title) {
  let completed = 0;

  for (const service of services) {
    if (await runOne(context, service, command, title, 'install')) {
      completed += 1;
    }
  }

  return completed;
}

async function runOne(context, service, command, title, field) {
  const issue = serviceExecutionIssue(context, { ...service, [field]: command }, field);

  if (issue) {
    warning(issue.message);
    info(issue.guidance);
    return false;
  }

  serviceExecutionWarnings(context, service).forEach((item) => {
    warning(item.message);
    info(item.guidance);
  });

  section(`${title}: ${service.name}`);
  line(`    ${paint('folder', 'dim')}   ${service.dir}`);
  line(`    ${paint('command', 'dim')}  ${paint(command, 'cyan')}`);
  line();
  await runShell(command, servicePath(context, service));
  return true;
}

module.exports = { runForServices, runSequential };
