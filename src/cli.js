'use strict';

const path = require('path');

const pkg = require('../package.json');
const { CONFIG_FILE } = require('./constants');
const { header, line, paint, style, padVisible, warning, fail } = require('./ui');
const { loadProjectContext } = require('./config');
const { setupProject } = require('./setup');
const { showMenu } = require('./menu');
const { scheduleUpdateCheck } = require('./update-check');
const { startDevelopment } = require('./commands/dev');
const { installAll } = require('./commands/install');
const { runForServices } = require('./commands/tasks');
const { cleanProject } = require('./commands/clean');
const { doctor } = require('./commands/doctor');
const { updateProject } = require('./commands/update');
const { showAbout } = require('./commands/about');

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
  scheduleUpdateCheck();

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

  if (command === 'setup' || command === 'init') {
    await setupProject();
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

  const commands = [
    ['setup', 'Configure the current project'],
    ['dev', 'Start all configured services'],
    ['install', 'Install dependencies for all services'],
    ['build', 'Build all services'],
    ['lint', 'Lint all services'],
    ['clean', 'Remove generated folders'],
    ['doctor', 'Check local tooling'],
    ['update', 'Pull latest changes and install dependencies'],
    ['about', 'Show CLI information'],
    ['help', 'Show this help']
  ];

  commands.forEach(([name, description]) => {
    line(`    ${style(padVisible(name, 9), 'accent')} ${paint(description, 'dim')}`);
  });

  line();
}

async function runCommand(command, context) {
  switch (command) {
    case 'menu':
      if (!process.stdin.isTTY) {
        showHelp();
        break;
      }

      await showMenu(context, runCommand);
      break;
    case 'dev':
      await startDevelopment(context);
      break;
    case 'install':
      await installAll(context);
      break;
    case 'build':
      await runForServices(context, 'build', 'Build All Services');
      break;
    case 'lint':
      await runForServices(context, 'lint', 'Lint All Services');
      break;
    case 'clean':
      cleanProject(context);
      break;
    case 'doctor':
      doctor(context);
      break;
    case 'update':
      await updateProject(context);
      break;
    case 'about':
      showAbout(context.config);
      break;
    default:
      header(context.config);
      fail(`Unknown command: ${command}`);
      line();
      showHelp();
      process.exitCode = 1;
  }
}

module.exports = { main };
