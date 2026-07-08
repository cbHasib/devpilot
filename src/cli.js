'use strict';

const path = require('path');

const pkg = require('../package.json');
const { CONFIG_FILE } = require('./constants');
const { header, line, paint, style, padVisible } = require('./ui');
const { warning, error } = require('./logger');
const { loadProjectContext } = require('./config');
const { scheduleUpdateCheck } = require('./update-check');
const { findCommand, visibleCommands } = require('./commands/registry');

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

  scheduleUpdateCheck();

  const commandDefinition = findCommand(command);

  if (commandDefinition && commandDefinition.requiresContext === false) {
    await commandDefinition.handler();
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
  await runCommand(selectedCommand, context);
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

async function runCommand(command, context) {
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

  await commandDefinition.handler(context, [], runCommand);
}

module.exports = { main };
