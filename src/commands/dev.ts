'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const {
  header,
  section,
  line,
  rule,
  bannerRow,
  paint,
  style
} = require('../ui');
const { info, success, warning } = require('../logger');
const { commandExists, isWsl, shellQuote, appleQuote, winQuote, servicePath } = require('../utils');
const { TAB_COLORS } = require('../constants');
const { serviceExecutionIssue, serviceExecutionWarnings } = require('../validation');
const { clearServiceLog } = require('../runtime/logs');
const { startService } = require('../runtime/processManager');
const { ensureRuntime, serviceKey, updateEntry } = require('../runtime/registry');
const { confirmStopServices } = require('../runtime/signals');
const { findProfile, findService: findConfiguredService, contextWithProfileEnv } = require('../profiles/manager');
const { runHooks } = require('../profiles/hooks');
const { normalizeDelay } = require('../profiles/dependencies');
const { createLaunchPlan, runLaunchPlan } = require('../profiles/scheduler');

async function startDevelopment(context) {
  const { config } = context;

  header(config);

  const services = config.services
    .filter((service) => service.dev)
    .filter((service) => {
      const issue = serviceExecutionIssue(context, service, 'dev');

      if (issue) {
        warning(issue.message);
        info(issue.guidance);
        return false;
      }

      serviceExecutionWarnings(context, service).forEach((item) => {
        warning(item.message);
        info(item.guidance);
      });

      return true;
    });

  if (services.length === 0) {
    warning('No services have a dev command configured.');
    return;
  }

  const plan = createLaunchPlan(context, services);
  plan.warnings.forEach((message) => warning(message));
  printLaunchPlan(context, plan.services);
  clearLaunchLogs(context, plan.services);

  await runHooks(context, 'beforeDev');

  const wantTabs = config.launchMode !== 'current';
  const useMacTabs = wantTabs
    && process.platform === 'darwin'
    && commandExists('osascript');
  const useGnomeTabs = wantTabs
    && process.platform === 'linux'
    && !isWsl()
    && commandExists('gnome-terminal');
  const useKonsoleTabs = wantTabs
    && process.platform === 'linux'
    && !isWsl()
    && !useGnomeTabs
    && commandExists('konsole');
  const useWindowsTabs = wantTabs
    && process.platform === 'win32'
    && commandExists('wt');
  const useWindowsWindows = wantTabs
    && process.platform === 'win32'
    && !useWindowsTabs;

  if (!useMacTabs && !useGnomeTabs && !useKonsoleTabs && !useWindowsTabs && !useWindowsWindows) {
    await runDevHere(context, plan, () => runHooks(context, 'afterDev'));
    return;
  }

  line();

  let placement = 'in separate tabs';
  let launcher = (launchContext, service, index) => openWindowsWindow(launchContext, service);

  if (useMacTabs) {
    launcher = openMacTab;
  } else if (useGnomeTabs) {
    launcher = openGnomeTab;
  } else if (useKonsoleTabs) {
    launcher = openKonsoleTab;
  } else if (useWindowsTabs) {
    launcher = openWindowsTab;
  } else {
    placement = 'in separate windows';
  }

  let launched = 0;

  await runLaunchPlan(plan, (service, index) => {
    if (!service.dev) {
      warning(`${service.name || service.dir} has no dev command and was skipped.`);
      return;
    }

    launcher(context, service, index);
    launched += 1;
    success(`${style(service.name, 'white', 'bold')}  ${paint('→', 'gray')}  ${paint(service.dev, 'dim')}`);
  });

  if (launched === 0) {
    warning('No services were launched.');
    return;
  }

  await runHooks(context, 'afterDev');
  devRunningBanner(launched, placement);
}

function devRunningBanner(count, placement) {
  const label = count === 1 ? 'service is' : 'services are';
  const message = `All ${count} ${label} now running`;

  line();
  line(rule('╭', '╮'));
  line(bannerRow(`${style('✓', 'green')} ${style(message, 'green', 'bold')}`, paint(placement, 'dim')));
  line(rule('╰', '╯'));
  line();
}

function printLaunchPlan(context, services) {
  const profile = context.config.activeProfile;

  section(profile ? 'Launching Profile' : 'Launching Workspace');

  if (profile) {
    line(`    ${paint('profile', 'dim')}  ${style(profile.name, 'white', 'bold')}`);
  }

  line(`    ${paint('services', 'dim')}`);
  services.forEach((service) => {
    const delay = normalizeDelay(service.delay);
    const suffix = delay > 0 ? paint(` delay ${delay}ms`, 'dim') : '';
    line(`      ${style(service.name || service.dir, 'white', 'bold')} ${paint(service.dir, 'dim')}${suffix}`);
  });
}

function clearLaunchLogs(context, services) {
  const cleared = services
    .map((service) => clearServiceLog(context, service))
    .reduce((total, count) => total + count, 0);

  if (cleared > 0) {
    info(`Cleared previous logs for ${cleared} ${cleared === 1 ? 'service' : 'services'}.`);
  }
}

function openMacTab(context, service) {
  const command = macTerminalCommand(context, service);
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
}

function macTerminalCommand(context, service) {
  const launcher = posixServiceLauncher(context, service);

  return [
    `cd ${shellQuote(servicePath(context, service))}`,
    "printf '\\033[2J\\033[3J\\033[H'",
    shellQuote(launcher)
  ].join(' && ');
}

function openGnomeTab(context, service) {
  const command = `${terminalManagedServiceCommand(context, service)}; exec bash`;
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
}

function openKonsoleTab(context, service) {
  const command = `${terminalManagedServiceCommand(context, service)}; exec bash`;
  spawn('konsole', [
    '--new-tab',
    '--workdir',
    servicePath(context, service),
    '-p',
    `tabtitle=${service.name}`,
    '-e',
    'bash',
    '-lc',
    command
  ], {
    detached: true,
    stdio: 'ignore'
  }).unref();
}

function openWindowsTab(context, service, index) {
  const dir = servicePath(context, service);
  const color = tabColor(service, index);
  const launcher = windowsServiceLauncher(context, service);

  // `-w 0` reuses the current Windows Terminal window instead of
  // spawning a brand new one, so the services open as tabs in place.
  spawn('wt', [
    '-w',
    '0',
    'new-tab',
    '--title',
    service.name || service.dir,
    '--tabColor',
    color,
    '-d',
    dir,
    'cmd.exe',
    '/d',
    '/k',
    'call',
    launcher
  ], {
    detached: true,
    stdio: 'ignore'
  }).unref();
}

function tabColor(service, index) {
  return service.color || TAB_COLORS[index % TAB_COLORS.length];
}

function openWindowsWindow(context, service) {
  const dir = winQuote(servicePath(context, service));
  const launcher = winQuote(windowsServiceLauncher(context, service));
  const command = `start ${winQuote(service.name || service.dir)} /D ${dir} cmd.exe /d /k call ${launcher}`;

  spawn(command, {
    shell: true,
    detached: true,
    stdio: 'ignore'
  }).unref();
}

function terminalManagedServiceCommand(context, service, platform = 'posix') {
  if (platform === 'win') {
    return `cd /d ${winQuote(servicePath(context, service))} && ${managedServiceCommand(context, service, 'win')}`;
  }

  return `cd ${shellQuote(servicePath(context, service))} && ${managedServiceCommand(context, service)}`;
}

function posixServiceLauncher(context, service) {
  const runtime = ensureRuntime(context.root);
  const launcher = path.join(runtime, `${serviceKey(service)}.sh`);
  const command = terminalManagedServiceCommand(context, service);

  fs.writeFileSync(launcher, `#!/bin/sh\n${command}\n`);
  fs.chmodSync(launcher, 0o755);
  return launcher;
}

function windowsServiceLauncher(context, service) {
  const runtime = ensureRuntime(context.root);
  const launcher = path.join(runtime, `${serviceKey(service)}.cmd`);
  const command = terminalManagedServiceCommand(context, service, 'win');

  fs.writeFileSync(launcher, `${command}\r\n`);
  return launcher;
}

async function runDevHere(context, plan, afterLaunch) {
  if (context.config.launchMode === 'current') {
    info('Running services in the current terminal.');
  } else {
    warning('Terminal tabs are unavailable. Running services in the current terminal.');
  }

  line('Press Ctrl+C to stop all services.');
  line();

  const running = [];
  let stopping = false;
  let prompting = false;

  const stopChildren = () => {
    if (stopping) {
      return;
    }

    stopping = true;
    running.forEach(({ child, key }) => {
      if (!child.killed) {
        killChild(child);
      }

      updateEntry(context.root, key, {
        status: 'stopped',
        stoppedAt: new Date().toISOString()
      });
    });
  };

  const onSignal = async () => {
    if (prompting) {
      return;
    }

    prompting = true;
    const shouldStop = await confirmStopServices();

    if (shouldStop) {
      stopChildren();
      process.exit(130);
      return;
    }

    prompting = false;
  };

  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    const done = [];

    await runLaunchPlan(plan, (service) => {
      if (!service.dev) {
        warning(`${service.name || service.dir} has no dev command and was skipped.`);
        return;
      }

      line(`${paint(`[${service.name}]`, 'cyan')} ${service.dev}`);
      const serviceProcess = startService(context, service, { mirror: true });
      running.push(serviceProcess);
      done.push(serviceProcess.done);
    });

    if (afterLaunch) {
      await afterLaunch();
    }

    const results = await Promise.all(done);

    const failed = results.find((code) => code !== 0);

    if (failed) {
      process.exitCode = failed;
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

async function runManagedService(context, args) {
  const parsed = parseManagedServiceArgs(args);
  const profile = parsed.profile ? findProfile(context.config, parsed.profile) : null;
  const runContext = profile ? contextWithProfileEnv(context, profile) : context;
  const service = findConfiguredService(context.config.services || [], parsed.target);

  if (!service) {
    warning(`Service not found: ${parsed.target || 'missing service name'}`);
    return;
  }

  await startService(runContext, service, { mirror: true, terminalSession: process.env.TERM_PROGRAM || process.env.TERM || null }).done;
}

function parseManagedServiceArgs(args = []) {
  const profileIndex = args.indexOf('--profile');

  if (profileIndex === -1) {
    return { target: args[0], profile: null };
  }

  return {
    target: args[0],
    profile: args[profileIndex + 1] || null
  };
}

function managedServiceCommand(context, service, platform = 'posix') {
  const args = [
    process.execPath,
    cliEntryPath(),
    '--project',
    context.root,
    '__run-service',
    service.dir
  ];
  const profile = context.config.activeProfile;

  if (profile && profile.id) {
    args.push('--profile', profile.id);
  }

  const quote = platform === 'win' ? winQuote : shellQuote;

  return args.map(quote).join(' ');
}

function cliEntryPath() {
  return fs.realpathSync(path.join(__dirname, '..', '..', 'bin', 'devpilot.js'));
}

function killChild(child) {
  if (process.platform === 'win32') {
    child.kill('SIGTERM');
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    child.kill('SIGTERM');
  }
}

module.exports = { runManagedService, startDevelopment };
