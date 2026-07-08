'use strict';

const path = require('path');

const pkg = require('../package.json');
const { CONFIG_FILE } = require('./constants');
const { header, line, paint, style, padVisible } = require('./ui');
const { warning, error } = require('./logger');
const { loadProjectContext } = require('./config');
const { scheduleUpdateCheck } = require('./update-check');
const { findCommand, visibleCommands } = require('./commands/registry');
const { applyProfileArg, listProfiles } = require('./profiles/manager');

function parseArgs(argv) {
  const args = [];
  let projectRoot = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      projectRoot = argv[index + 1] ? path.resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }

    args.push(arg);
  }

  return { args, projectRoot };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.args[0];

  if (command === '--version' || command === '-v') {
    line(pkg.version);
    return;
  }

  if (command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    return;
  }

  scheduleUpdateCheck({ notifyOnExit: shouldPrintExitUpdateNotice(command) });

  const commandDefinition = findCommand(command);

  if (commandDefinition && commandDefinition.requiresContext === false) {
    await commandDefinition.handler(null, parsed.args.slice(1));
    return;
  }

  const context = loadProjectContext(parsed.projectRoot || process.cwd());

  if (!context) {
    header();
    warning(`No ${CONFIG_FILE} found from ${process.cwd()} upward.`);
    line(`Run ${paint('devpilot setup', 'cyan')} from your project root first.`);
    return;
  }

  const selectedCommand = command || 'menu';
  await runCommand(selectedCommand, context, parsed.args.slice(1));
}

function showHelp() {
  header();
  line(`  ${paint('Usage', 'dim')}  ${style('devpilot', 'accent', 'bold')} ${paint('<command>', 'dim')}`);
  line();
  line(`  ${style('Commands', 'white', 'bold')}`);

  const commands = visibleCommands()
    .map((entry) => [entry.name, entry.description])
    .concat([['help', 'Show this help']]);

  commands.forEach(([name, description]) => {
    line(`    ${style(padVisible(name, 9), 'accent')} ${paint(description, 'dim')}`);
  });

  line();
}

async function runCommand(command, context, args = []) {
  const commandDefinition = findCommand(command);

  if (!commandDefinition) {
    header(context.config);
    error(`Unknown command: ${command}`);
    line();
    showHelp();
    process.exitCode = 1;
    return;
  }

  if (commandDefinition.name === 'menu' && !process.stdin.isTTY) {
    showHelp();
    return;
  }

  const profileResult = commandProfileContext(commandDefinition, context, args);

  if (!profileResult.ok) {
    header(context.config);
    profileResult.warnings.forEach((message) => warning(message));
    printProfileHint(context);
    process.exitCode = 1;
    return;
  }

  profileResult.warnings.forEach((message) => warning(message));
  await commandDefinition.handler(profileResult.context, profileResult.args, runCommand);
}

function shouldPrintExitUpdateNotice(command) {
  if (!command || command === 'menu') {
    return false;
  }

  return !['upgrade', 'self-update', 'selfupdate'].includes(command);
}

function commandProfileContext(commandDefinition, context, args) {
  if (!commandDefinition.profileMode) {
    return { context, args, warnings: [], ok: true };
  }

  // Profile arguments are resolved once in the dispatcher so command handlers
  // can keep working with `context.config.services` as their active scope.
  return applyProfileArg(context, args, {
    strict: commandDefinition.profileMode === 'strict'
  });
}

function printProfileHint(context) {
  const profiles = listProfiles(context.config);

  if (profiles.length === 0) {
    line(`Run ${paint('devpilot profile create', 'cyan')} to create one.`);
    return;
  }

  line(`Available profiles: ${profiles.map((profile) => paint(profile.id, 'cyan')).join(', ')}`);
}

module.exports = { main };
