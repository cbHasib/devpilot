'use strict';

const clack = require('@clack/prompts');

const { clearScreen, header, line, paint, style, padVisible, waitForEnter } = require('./ui');
const { error: logError } = require('./logger');
const { cachedUpdate, printMenuUpdateBanner } = require('./update-check');
const { contextForProfile, findProfile, listProfiles } = require('./profiles/manager');
const { statusMark, workspaceStatus } = require('./runtime/status');

async function showMenu(context, runCommand) {
  const selectedContext = await chooseProfileContext(context);

  if (!selectedContext) {
    farewell();
    return;
  }

  context = selectedContext;

  while (true) {
    const update = cachedUpdate();

    clearScreen();
    header(context.config);
    printServiceOverview(context.config);
    printRuntimeOverview(context);
    printMenuUpdateBanner(update);
    line();

    const action = await selectMenuAction(update);

    if (clack.isCancel(action) || action === null || action === 'exit') {
      farewell();
      return;
    }

    clearScreen();

    try {
      await runCommand(action, context);
    } catch (error) {
      line();
      logError(error.message);
    }

    if (action === 'dev') {
      return;
    }

    line();
    await waitForEnter(`  ${paint('Press Enter to return to the menu…', 'dim')}`);
  }
}

function menuOptions(update) {
  const options = [
    { value: 'dev', label: 'Start Development', hint: 'launch every service in its own tab' },
    { value: 'install', label: 'Install Dependencies', hint: 'install packages for all services' },
    { value: 'build', label: 'Build All Services', hint: 'run each service build script' },
    { value: 'lint', label: 'Lint All Services', hint: 'run each service lint script' },
    { value: 'open', label: 'Open Directory', hint: 'open the project or a service in your file manager' },
    { value: 'code', label: 'Open in Editor', hint: 'open the project or a service in your editor' },
    { value: 'clean', label: 'Clean Project', hint: 'remove node_modules, dist, and caches' },
    { value: 'status', label: 'Workspace Status', hint: 'show managed service state' },
    { value: 'logs', label: 'Logs', hint: 'follow DevPilot-managed service logs' },
    { value: 'restart', label: 'Restart', hint: 'restart managed services' },
    { value: 'stop', label: 'Stop', hint: 'stop managed services' },
    { value: 'info', label: 'Workspace Info', hint: 'show detected frameworks and workspace details' },
    { value: 'doctor', label: 'Doctor', hint: 'check local tooling and configuration' },
    { value: 'update', label: 'Update Project', hint: 'pull latest changes and reinstall' },
    { value: 'profiles', label: 'Profiles', hint: 'list and manage workspace profiles' },
    { value: 'about', label: 'About', hint: 'version and project links' },
    { value: 'exit', label: 'Exit', hint: 'leave DevPilot' }
  ];

  if (!update) {
    return options;
  }

  return [
    {
      value: 'upgrade',
      label: 'Update DevPilot',
      hint: `press U · v${update.current} -> v${update.latest}`
    },
    ...options
  ];
}

async function selectMenuAction(update) {
  const options = menuOptions(update);

  if (!update || !process.stdin.isTTY) {
    return clack.select({
      message: 'What would you like to do?',
      options
    });
  }

  const controller = new AbortController();
  let shortcutAction = null;

  // Clack owns raw-mode rendering for the menu. The update hotkey only listens
  // for "u", aborts the native prompt, and lets Clack perform its own cleanup.
  const onKeypress = (chunk, key: any = {}) => {
    if (shortcutAction || key.ctrl || key.meta) {
      return;
    }

    const value = key.name && key.name.length === 1 ? key.name : chunk;

    if (String(value || '').toLowerCase() === 'u') {
      shortcutAction = 'upgrade';
      controller.abort();
    }
  };

  process.stdin.on('keypress', onKeypress);

  try {
    const action = await clack.select({
      message: 'What would you like to do?',
      options,
      signal: controller.signal
    });

    return shortcutAction || action;
  } finally {
    process.stdin.off('keypress', onKeypress);
  }
}

async function chooseProfileContext(context) {
  const profiles = listProfiles(context.config);

  if (profiles.length < 2 || !process.stdin.isTTY) {
    return context;
  }

  clearScreen();
  header(context.config);
  line();

  const choice = await clack.select({
    message: 'Choose profile',
    options: [
      { value: '__all__', label: 'All Services', hint: 'use the full workspace' },
      ...profiles.map((profile) => ({
        value: profile.id,
        label: profile.name,
        hint: profile.services.includes('*') ? 'all services' : profile.services.join(', ')
      }))
    ]
  });

  if (clack.isCancel(choice)) {
    return null;
  }

  if (choice === '__all__') {
    return context;
  }

  const profile = findProfile(context.config, choice);
  const resolved = contextForProfile(context, profile);

  resolved.warnings.forEach((message) => {
    line(`  ${paint('▲', 'yellow')} ${message}`);
  });

  return resolved.context;
}

function printRuntimeOverview(context) {
  const statuses = workspaceStatus(context);
  const hasRuntime = statuses.some((item) => item.status !== 'unknown');

  if (!hasRuntime) {
    return;
  }

  line();
  line(`  ${style('Workspace', 'white', 'bold')}`);
  statuses.slice(0, 6).forEach((item) => {
    const color = item.status === 'running' ? 'green' : item.status === 'unknown' ? 'yellow' : 'red';
    line(`  ${padVisible(item.service.name || item.service.dir, 18)} ${paint(statusMark(item.status), color)} ${paint(item.uptime || '', 'dim')}`);
  });

  if (statuses.length > 6) {
    line(`  ${paint(`+${statuses.length - 6} more`, 'dim')}`);
  }
}

function printServiceOverview(config) {
  const services = (config.services || []).filter((service) => service.framework);

  if (services.length === 0) {
    return;
  }

  const visible = services.slice(0, 6);

  line();
  visible.forEach((service) => {
    line(`  ${style(padVisible(service.name, 18), 'white', 'bold')} ${paint(service.framework, 'dim')}`);
  });

  if (services.length > visible.length) {
    line(`  ${paint(`+${services.length - visible.length} more`, 'dim')}`);
  }
}

function farewell() {
  clearScreen();
  line();
  line(`  ${style('◆', 'accent')} ${paint('See you next time.', 'dim')}`);
  line();
}

module.exports = { showMenu };
