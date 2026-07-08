'use strict';

const { spawn } = require('child_process');

const clack = require('@clack/prompts');

const { header, section, success, warning, info, line, paint } = require('../ui');
const { CONFIG_FILE } = require('../constants');
const { servicePath, commandExists, winQuote } = require('../utils');

const DEFAULT_EDITOR = 'code';

async function openDirectory(context) {
  header(context.config);
  section('Open Directory');

  const target = await chooseTarget(context, 'Which folder should we open?');

  if (!target) {
    return;
  }

  launch(fileManagerCommand(), [target.path]);
  success(`Opening ${paint(target.label, 'white')} in your file manager.`);
}

async function openInEditor(context) {
  header(context.config);

  const editor = context.config.editor || DEFAULT_EDITOR;

  section(`Open in ${editorLabel(editor)}`);

  if (!commandExists(editor)) {
    warning(`Editor command "${editor}" was not found on your PATH.`);
    line();
    info(`Install its shell command (in VS Code: "Shell Command: Install 'code' command in PATH"),`);
    info(`or set "editor" to your editor's command in ${paint(CONFIG_FILE, 'cyan')}.`);
    return;
  }

  const target = await chooseTarget(context, 'What should we open?');

  if (!target) {
    return;
  }

  launch(editor, [target.path]);
  success(`Opening ${paint(target.label, 'white')} in ${editorLabel(editor)}.`);
}

async function chooseTarget(context, message) {
  const root = {
    label: context.config.projectName || 'Workspace root',
    path: context.root
  };
  const services = context.config.services || [];

  if (!process.stdin.isTTY || services.length === 0) {
    return root;
  }

  const choice = await clack.select({
    message,
    options: [
      { value: '__root__', label: root.label, hint: 'workspace root' },
      ...services.map((service, index) => ({
        value: index,
        label: service.name,
        hint: service.dir
      }))
    ]
  });

  if (clack.isCancel(choice)) {
    return null;
  }

  if (choice === '__root__') {
    return root;
  }

  const service = services[choice];
  return { label: service.name, path: servicePath(context, service) };
}

function fileManagerCommand() {
  if (process.platform === 'darwin') {
    return 'open';
  }

  if (process.platform === 'win32') {
    return 'explorer';
  }

  return 'xdg-open';
}

function editorLabel(editor) {
  return editor === DEFAULT_EDITOR ? 'VS Code' : editor;
}

function launch(command, args) {
  if (process.platform === 'win32') {
    // Editor/tool launchers on Windows are often `.cmd` shims that only run
    // through a shell, so build a quoted command string instead of argv.
    const quoted = args.map((arg) => winQuote(arg)).join(' ');
    spawn(`${command} ${quoted}`, { shell: true, detached: true, stdio: 'ignore' }).unref();
    return;
  }

  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}

module.exports = { openDirectory, openInEditor };
