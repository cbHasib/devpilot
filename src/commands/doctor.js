'use strict';

const { header, section, line, paint, success, fail, warning } = require('../ui');
const { commandOutput, commandExists, packageManagerLabel, isWsl } = require('../utils');

function doctor(context) {
  header(context.config);
  section('Tools');
  printVersion('Node', 'node', ['--version']);
  printVersion(packageManagerLabel(context.config.packageManager), context.config.packageManager, ['--version']);
  printVersion('Git', 'git', ['--version']);

  const editor = context.config.editor || 'code';
  printAvailable(`Editor (${editor})`, editor);

  section('Project');
  line(`    ${paint('root', 'dim')}         ${context.root}`);
  line(`    ${paint('services', 'dim')}     ${context.config.services.length}`);
  line(`    ${paint('launch mode', 'dim')}  ${context.config.launchMode}`);

  section('Terminal');

  if (process.platform === 'darwin') {
    printAvailable('Apple Terminal automation', 'osascript');
  } else if (process.platform === 'linux' && !isWsl()) {
    printAvailable('GNOME Terminal tabs', 'gnome-terminal');
  } else if (process.platform === 'win32') {
    if (commandExists('wt')) {
      success('Windows Terminal tabs: available');
    } else {
      warning('Windows Terminal not installed — services will open in separate windows.');
    }
  } else {
    warning('Dev command will run services in the current terminal.');
  }
}

function printVersion(label, command, args) {
  const version = commandOutput(command, args);

  if (version) {
    success(`${label}: ${version}`);
  } else {
    fail(`${label}: missing`);
  }
}

function printAvailable(label, command) {
  if (commandExists(command)) {
    success(`${label}: available`);
  } else {
    warning(`${label}: unavailable`);
  }
}

module.exports = { doctor };
