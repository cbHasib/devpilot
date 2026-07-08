'use strict';

const clack = require('@clack/prompts');

const { clearScreen, header, line, paint, style, padVisible, waitForEnter } = require('./ui');
const { error: logError } = require('./logger');
const { statusMark, workspaceStatus } = require('./runtime/status');

async function showMenu(context, runCommand) {
  while (true) {
    clearScreen();
    header(context.config);
    printServiceOverview(context.config);
    printRuntimeOverview(context);
    line();

    const action = await clack.select({
      message: 'What would you like to do?',
      options: [
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
        { value: 'about', label: 'About', hint: 'version and project links' },
        { value: 'exit', label: 'Exit', hint: 'leave DevPilot' }
      ]
    });

    if (clack.isCancel(action) || action === 'exit') {
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
