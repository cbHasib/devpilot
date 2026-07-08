'use strict';

const { section, line, paint } = require('../ui');
const { info, warning } = require('../logger');
const { runShell } = require('../utils');
const { normalizeHooks, profileEnv } = require('./manager');

async function runHooks(context, name) {
  const commands = hookCommands(context, name);

  if (commands.length === 0) {
    return;
  }

  section(hookTitle(name));

  for (const command of commands) {
    line(`    ${paint(command, 'cyan')}`);

    try {
      await runShell(command, context.root, { env: profileEnv(context) });
    } catch (error) {
      warning(error.message);
      info(`Hook "${name}" stopped further automation.`);
      throw error;
    }
  }
}

function hookCommands(context, name) {
  const hooks = normalizeHooks(context.config && context.config.hooks);
  return hooks[name] || [];
}

function hookTitle(name) {
  if (name === 'beforeDev') {
    return 'Before Development';
  }

  if (name === 'afterDev') {
    return 'After Development';
  }

  return `Hook: ${name}`;
}

module.exports = {
  hookCommands,
  runHooks
};
