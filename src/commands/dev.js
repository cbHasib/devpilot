'use strict';

const { spawn, spawnSync } = require('child_process');

const {
  header,
  section,
  success,
  warning,
  line,
  rule,
  bannerRow,
  paint,
  style
} = require('../ui');
const { commandExists, isWsl, shellQuote, appleQuote, servicePath } = require('../utils');

async function startDevelopment(context) {
  const { config } = context;
  const services = config.services.filter((service) => service.dev);

  header(config);

  if (services.length === 0) {
    warning('No services have a dev command configured.');
    return;
  }

  section('Start Development');

  const useMacTabs = config.launchMode !== 'current'
    && process.platform === 'darwin'
    && commandExists('osascript');
  const useGnomeTabs = config.launchMode !== 'current'
    && process.platform === 'linux'
    && !isWsl()
    && commandExists('gnome-terminal');

  if (!useMacTabs && !useGnomeTabs) {
    await runDevHere(context, services);
    return;
  }

  line();

  if (useMacTabs) {
    openMacTabs(context, services);
  } else {
    openGnomeTabs(context, services);
  }

  services.forEach((service) => {
    success(`${style(service.name, 'white', 'bold')}  ${paint('→', 'gray')}  ${paint(service.dev, 'dim')}`);
  });

  devRunningBanner(services.length);
}

function devRunningBanner(count) {
  const label = count === 1 ? 'service is' : 'services are';
  const message = `All ${count} ${label} now running`;

  line();
  line(rule('╭', '╮'));
  line(bannerRow(`${style('✓', 'green')} ${style(message, 'green', 'bold')}`, paint('in separate tabs', 'dim')));
  line(rule('╰', '╯'));
  line();
}

function openMacTabs(context, services) {
  services.forEach((service) => {
    const command = `cd ${shellQuote(servicePath(context, service))}; ${service.dev}`;
    const script = [
      'tell application "Terminal"',
      'activate',
      'tell application "System Events"',
      'keystroke "t" using command down',
      'end tell',
      'delay 0.3',
      `do script ${appleQuote(command)} in selected tab of front window`,
      'end tell'
    ].join('\n');

    spawnSync('osascript', ['-e', script], { stdio: 'ignore' });
  });
}

function openGnomeTabs(context, services) {
  services.forEach((service) => {
    const command = `cd ${shellQuote(servicePath(context, service))} && ${service.dev}; exec bash`;
    spawn('gnome-terminal', [
      '--tab',
      `--title=${service.name}`,
      '--',
      'bash',
      '-lc',
      command
    ], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  });
}

async function runDevHere(context, services) {
  warning('Terminal tabs are unavailable. Running services in the current terminal.');
  line('Press Ctrl+C to stop all services.');
  line();

  const children = [];
  let stopping = false;

  const stopChildren = () => {
    if (stopping) {
      return;
    }

    stopping = true;
    children.forEach((child) => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
  };

  process.once('SIGINT', () => {
    stopChildren();
    process.exit(130);
  });

  const results = await Promise.all(services.map((service) => {
    line(`${paint(`[${service.name}]`, 'cyan')} ${service.dev}`);
    const child = spawn(service.dev, {
      cwd: servicePath(context, service),
      shell: true,
      stdio: 'inherit'
    });
    children.push(child);

    return new Promise((resolve) => {
      child.on('close', (code) => resolve(code || 0));
    });
  }));

  const failed = results.find((code) => code !== 0);

  if (failed) {
    process.exitCode = failed;
  }
}

module.exports = { startDevelopment };
