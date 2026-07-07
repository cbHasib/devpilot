#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { spawn, spawnSync, execFileSync } = require('child_process');

const pkg = require('../package.json');

const CONFIG_FILE = '.devpilot.json';
const STATE_DIR = '.devpilot';
const ALIAS_MARKER = 'DevPilot generated alias';

const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  reverse: '\x1b[7m',
  accent: '\x1b[38;5;173m',
  accentSoft: '\x1b[38;5;216m',
  cyan: '\x1b[38;5;80m',
  green: '\x1b[38;5;114m',
  yellow: '\x1b[38;5;179m',
  red: '\x1b[38;5;203m',
  gray: '\x1b[38;5;245m',
  white: '\x1b[38;5;253m'
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const BANNER_WIDTH = 60;

function paint(value, color) {
  return colorEnabled && colors[color] ? `${colors[color]}${value}${colors.reset}` : value;
}

function style(value, ...names) {
  if (!colorEnabled) {
    return value;
  }

  const prefix = names.map((name) => colors[name] || '').join('');
  return `${prefix}${value}${colors.reset}`;
}

function visibleLength(value) {
  return String(value).replace(ANSI_PATTERN, '').length;
}

function padVisible(value, width) {
  const padding = width - visibleLength(value);
  return padding > 0 ? `${value}${' '.repeat(padding)}` : value;
}

function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

function line(value = '') {
  console.log(value);
}

function rule(left, right) {
  return paint(`${left}${'─'.repeat(BANNER_WIDTH)}${right}`, 'accent');
}

function bannerRow(left, right = '') {
  const gap = BANNER_WIDTH - 2 - visibleLength(left) - visibleLength(right);
  const spacer = gap > 0 ? ' '.repeat(gap) : ' ';
  return `${paint('│', 'accent')} ${left}${spacer}${right} ${paint('│', 'accent')}`;
}

function header(config) {
  line(rule('╭', '╮'));
  line(bannerRow(
    `${style('◆', 'accent')} ${style('DevPilot', 'accent', 'bold')}  ${paint('Project Management CLI', 'dim')}`,
    paint(`v${pkg.version}`, 'dim')
  ));

  if (config) {
    const count = config.services ? config.services.length : 0;
    const meta = `${paint('alias', 'dim')} ${config.alias}  ${paint('·', 'gray')}  ${count} ${count === 1 ? 'service' : 'services'}`;
    line(bannerRow(style(config.projectName, 'white', 'bold'), meta));
  }

  line(rule('╰', '╯'));
}

function section(title) {
  line();
  line(`  ${paint('▸', 'accent')} ${style(title, 'white', 'bold')}`);
}

function success(message) {
  line(`  ${paint('✓', 'green')} ${message}`);
}

function warning(message) {
  line(`  ${paint('▲', 'yellow')} ${message}`);
}

function fail(message) {
  line(`  ${paint('✗', 'red')} ${message}`);
}

function info(message) {
  line(`  ${paint('›', 'accent')} ${message}`);
}

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
      await showMenu(context);
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

async function showMenu(context) {
  if (!process.stdin.isTTY) {
    showHelp();
    return;
  }

  const items = [
    { label: 'Start Development', command: 'dev', hint: 'Launch every service in its own tab' },
    { label: 'Install Dependencies', command: 'install', hint: 'Install packages for all services' },
    { label: 'Build All Services', command: 'build', hint: 'Run each service build script' },
    { label: 'Lint All Services', command: 'lint', hint: 'Run each service lint script' },
    { label: 'Clean Project', command: 'clean', hint: 'Remove node_modules, dist, and caches' },
    { label: 'Doctor', command: 'doctor', hint: 'Check local tooling and configuration' },
    { label: 'Update Project', command: 'update', hint: 'Pull latest changes and reinstall' },
    { label: 'About', command: 'about', hint: 'Version and project links' },
    { label: 'Exit', command: 'exit', hint: 'Leave DevPilot' }
  ];

  let selected = 0;

  while (true) {
    clearScreen();
    header(context.config);
    line(`  ${style('What would you like to do?', 'white', 'bold')}`);
    line();

    items.forEach((item, index) => {
      const active = index === selected;

      if (active) {
        const label = padVisible(style(item.label, 'accent', 'bold'), 24);
        line(`  ${style('❯', 'accent')} ${label}${paint(item.hint, 'dim')}`);
      } else {
        line(`    ${padVisible(paint(item.label, 'gray'), 24)}`);
      }
    });

    line();
    line(`  ${paint('↑ ↓', 'accent')} ${paint('navigate', 'dim')}    ${paint('enter', 'accent')} ${paint('select', 'dim')}    ${paint('q', 'accent')} ${paint('quit', 'dim')}`);

    const key = await readKey();

    if (key === 'up') {
      selected = selected === 0 ? items.length - 1 : selected - 1;
      continue;
    }

    if (key === 'down') {
      selected = selected === items.length - 1 ? 0 : selected + 1;
      continue;
    }

    if (key === 'quit') {
      farewell();
      return;
    }

    if (key === 'enter') {
      const item = items[selected];

      if (item.command === 'exit') {
        farewell();
        return;
      }

      clearScreen();

      try {
        await runCommand(item.command, context);
      } catch (error) {
        line();
        fail(error.message);
      }

      if (item.command === 'dev') {
        return;
      }

      line();
      await waitForEnter(`  ${paint('Press Enter to return to the menu…', 'dim')}`);
    }
  }
}

function farewell() {
  clearScreen();
  line();
  line(`  ${style('◆', 'accent')} ${paint('See you next time.', 'dim')}`);
  line();
}

function readKey() {
  return new Promise((resolve) => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (buffer) => {
      process.stdin.setRawMode(wasRaw);
      const key = buffer.toString('utf8');

      if (key === '\u0003') {
        clearScreen();
        process.exit(130);
      }

      if (key === '\r' || key === '\n') {
        resolve('enter');
        return;
      }

      if (key === 'q' || key === 'Q' || key === '\u001b') {
        resolve('quit');
        return;
      }

      if (key === '\u001b[A') {
        resolve('up');
        return;
      }

      if (key === '\u001b[B') {
        resolve('down');
        return;
      }

      resolve('other');
    });
  });
}

async function setupProject() {
  const root = process.cwd();
  const rl = readline.createInterface({ input, output });

  try {
    clearScreen();
    header();
    line(`Setting up DevPilot in ${paint(root, 'cyan')}`);
    line();

    const projectName = await ask(rl, 'Project display name', titleCase(path.basename(root)));
    const alias = await askAlias(rl, defaultAlias(projectName || path.basename(root)));
    const packageManager = await askChoice(
      rl,
      'Package manager',
      ['yarn', 'npm', 'pnpm', 'bun'],
      detectPackageManager(root)
    );
    const launchMode = await askChoice(
      rl,
      'Development launch mode',
      ['tabs', 'current'],
      'tabs'
    );

    const detectedServices = detectServices(root, packageManager);
    const services = [];

    if (detectedServices.length > 0) {
      section('Detected Services');
      detectedServices.forEach((service) => {
        line(`- ${service.dir} (${service.name})`);
      });
      line();

      for (const service of detectedServices) {
        const include = await confirm(rl, `Include ${service.dir}?`, true);

        if (!include) {
          continue;
        }

        services.push(await editService(rl, service));
      }
    }

    while (services.length === 0 || await confirm(rl, 'Add another service manually?', false)) {
      services.push(await promptService(rl, packageManager));
    }

    const config = {
      schemaVersion: 1,
      projectName,
      alias,
      packageManager,
      launchMode,
      services,
      createdAt: new Date().toISOString()
    };

    writeConfig(root, config);
    ensureGitignore(root);

    const shouldCreateAlias = await confirm(rl, `Create global command alias "${alias}"?`, true);
    let aliasPath = null;

    if (shouldCreateAlias) {
      aliasPath = await createGlobalAlias(rl, alias, root);
    }

    section('Done');
    success(`Wrote ${CONFIG_FILE}`);
    success(`Updated .gitignore with ${CONFIG_FILE} and ${STATE_DIR}/`);

    if (aliasPath) {
      success(`Created alias: ${aliasPath}`);
    }

    line();
    line(`Try ${paint(`${alias} dev`, 'cyan')} or ${paint('devpilot', 'cyan')}.`);
  } finally {
    rl.close();
  }
}

async function ask(rl, question, defaultValue = '') {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function askAlias(rl, defaultValue) {
  while (true) {
    const alias = (await ask(rl, 'Command alias', defaultValue)).trim();

    if (alias === 'devpilot') {
      warning('Alias cannot be "devpilot" because that is the package command.');
      continue;
    }

    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(alias)) {
      return alias;
    }

    warning('Use letters, numbers, underscores, or hyphens. Start with a letter.');
  }
}

async function askChoice(rl, question, choices, defaultValue) {
  const normalizedDefault = choices.includes(defaultValue) ? defaultValue : choices[0];

  while (true) {
    const answer = await ask(rl, `${question} [${choices.join('/')}]`, normalizedDefault);

    if (choices.includes(answer)) {
      return answer;
    }

    warning(`Choose one of: ${choices.join(', ')}`);
  }
}

async function confirm(rl, question, defaultValue) {
  const marker = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} [${marker}]: `)).trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === 'y' || answer === 'yes';
}

async function editService(rl, service) {
  line();
  const dir = await ask(rl, 'Service folder', service.dir);
  const name = await ask(rl, 'Service name', service.name);
  const dev = await ask(rl, 'Dev command', service.dev);
  const build = await ask(rl, 'Build command', service.build);
  const lint = await ask(rl, 'Lint command', service.lint);

  return cleanService({ dir, name, dev, build, lint });
}

async function promptService(rl, packageManager) {
  section('Manual Service');
  const dir = await ask(rl, 'Service folder');
  const name = await ask(rl, 'Service name', titleCase(path.basename(dir || 'service')));
  const dev = await ask(rl, 'Dev command', scriptCommand(packageManager, 'dev'));
  const build = await ask(rl, 'Build command', scriptCommand(packageManager, 'build'));
  const lint = await ask(rl, 'Lint command', scriptCommand(packageManager, 'lint'));

  return cleanService({ dir, name, dev, build, lint });
}

function cleanService(service) {
  return {
    dir: service.dir.trim(),
    name: service.name.trim(),
    dev: service.dev.trim(),
    build: service.build.trim(),
    lint: service.lint.trim()
  };
}

function detectServices(root, packageManager) {
  const ignored = new Set([
    '.git',
    '.next',
    '.turbo',
    'coverage',
    'dist',
    'node_modules',
    STATE_DIR
  ]);

  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ignored.has(entry.name))
    .map((entry) => {
      const packagePath = path.join(root, entry.name, 'package.json');

      if (!fs.existsSync(packagePath)) {
        return null;
      }

      const packageJson = readJson(packagePath);
      const scripts = packageJson.scripts || {};

      return cleanService({
        dir: entry.name,
        name: titleCase(packageJson.name || entry.name),
        dev: inferScript(packageManager, scripts, ['start:dev', 'dev', 'start']),
        build: inferScript(packageManager, scripts, ['build']),
        lint: inferScript(packageManager, scripts, ['lint'])
      });
    })
    .filter(Boolean);
}

function inferScript(packageManager, scripts, candidates) {
  const script = candidates.find((candidate) => scripts[candidate]);
  return script ? scriptCommand(packageManager, script) : '';
}

function scriptCommand(packageManager, script) {
  if (!script) {
    return '';
  }

  if (packageManager === 'npm') {
    return `npm run ${script}`;
  }

  if (packageManager === 'bun') {
    return `bun run ${script}`;
  }

  return `${packageManager} ${script}`;
}

function detectPackageManager(root) {
  if (fs.existsSync(path.join(root, 'yarn.lock'))) {
    return 'yarn';
  }

  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) {
    return 'bun';
  }

  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    return 'npm';
  }

  return 'yarn';
}

function writeConfig(root, config) {
  const file = path.join(root, CONFIG_FILE);
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function ensureGitignore(root) {
  const gitignorePath = path.join(root, '.gitignore');
  const entries = [CONFIG_FILE, `${STATE_DIR}/`];
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const existingLines = new Set(content.split(/\r?\n/).map((lineValue) => lineValue.trim()));
  const missing = entries.filter((entry) => !existingLines.has(entry));

  if (missing.length === 0) {
    return;
  }

  if (content && !content.endsWith('\n')) {
    content += '\n';
  }

  if (!existingLines.has('# DevPilot local config')) {
    content += '\n# DevPilot local config\n';
  }

  content += `${missing.join('\n')}\n`;
  fs.writeFileSync(gitignorePath, content);
}

async function createGlobalAlias(rl, alias, projectRoot) {
  const binDir = getGlobalBinDir();
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    return createWindowsAlias(rl, binDir, alias, projectRoot);
  }

  return createPosixAlias(rl, binDir, alias, projectRoot);
}

async function createPosixAlias(rl, binDir, alias, projectRoot) {
  const aliasPath = path.join(binDir, alias);
  const cliPath = fs.realpathSync(__filename);
  const content = [
    '#!/usr/bin/env bash',
    `# ${ALIAS_MARKER}. Do not edit by hand.`,
    `exec node ${shellQuote(cliPath)} --project ${shellQuote(projectRoot)} "$@"`,
    ''
  ].join('\n');

  const wroteAlias = await writeAliasFile(rl, aliasPath, content);

  if (!wroteAlias) {
    return null;
  }

  fs.chmodSync(aliasPath, 0o755);

  return aliasPath;
}

async function createWindowsAlias(rl, binDir, alias, projectRoot) {
  const aliasPath = path.join(binDir, `${alias}.cmd`);
  const cliPath = fs.realpathSync(__filename);
  const content = [
    '@echo off',
    `REM ${ALIAS_MARKER}. Do not edit by hand.`,
    `node "${cliPath}" --project "${projectRoot}" %*`,
    ''
  ].join('\r\n');

  const wroteAlias = await writeAliasFile(rl, aliasPath, content);

  if (!wroteAlias) {
    return null;
  }

  return aliasPath;
}

async function writeAliasFile(rl, aliasPath, content) {
  if (fs.existsSync(aliasPath)) {
    const existing = fs.readFileSync(aliasPath, 'utf8');

    if (!existing.includes(ALIAS_MARKER)) {
      const overwrite = await confirm(rl, `${aliasPath} already exists. Overwrite it?`, false);

      if (!overwrite) {
        warning('Skipped alias creation.');
        return false;
      }
    }
  }

  fs.writeFileSync(aliasPath, content);
  return true;
}

function getGlobalBinDir() {
  try {
    const prefix = execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8' }).trim();
    return process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
  } catch (error) {
    return path.dirname(process.execPath);
  }
}

function loadProjectContext(startDir) {
  const resolved = path.resolve(startDir);
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  const root = stat && stat.isFile() ? path.dirname(resolved) : findConfigRoot(resolved);

  if (!root) {
    return null;
  }

  const config = readJson(path.join(root, CONFIG_FILE));
  return { root, config };
}

function findConfigRoot(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, CONFIG_FILE))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

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

async function installAll(context) {
  header(context.config);
  await installServices(context);
}

async function installServices(context) {
  const services = context.config.services;

  if (services.length === 0) {
    warning('No services are configured.');
    return;
  }

  const command = installCommand(context.config.packageManager);
  await runSequential(context, services, command, 'Install Dependencies');
  completionBanner(`Dependencies installed for ${countLabel(services.length)}`);
}

async function runForServices(context, field, title) {
  const services = context.config.services.filter((service) => service[field]);
  header(context.config);

  if (services.length === 0) {
    warning(`No services have a ${field} command configured.`);
    return;
  }

  for (const service of services) {
    await runOne(context, service, service[field], title);
  }

  completionBanner(`${title} finished for ${countLabel(services.length)}`);
}

async function runSequential(context, services, command, title) {
  for (const service of services) {
    await runOne(context, service, command, title);
  }
}

async function runOne(context, service, command, title) {
  section(`${title}: ${service.name}`);
  line(`    ${paint('folder', 'dim')}   ${service.dir}`);
  line(`    ${paint('command', 'dim')}  ${paint(command, 'cyan')}`);
  line();
  await runShell(command, servicePath(context, service));
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'service' : 'services'}`;
}

function completionBanner(message) {
  line();
  line(`  ${paint('✓', 'green')} ${style(message, 'green', 'bold')}`);
}

function cleanProject(context) {
  const targets = ['node_modules', 'dist', '.next', 'coverage'];
  header(context.config);

  context.config.services.forEach((service) => {
    section(`Clean: ${service.name}`);
    const root = servicePath(context, service);
    let removed = 0;

    targets.forEach((target) => {
      const fullPath = path.join(root, target);

      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        success(`Removed ${service.dir}/${target}`);
        removed += 1;
      }
    });

    if (removed === 0) {
      info('Nothing to remove.');
    }
  });

  completionBanner('Clean complete');
}

function doctor(context) {
  header(context.config);
  section('Tools');
  printVersion('Node', 'node', ['--version']);
  printVersion(packageManagerLabel(context.config.packageManager), context.config.packageManager, ['--version']);
  printVersion('Git', 'git', ['--version']);

  section('Project');
  line(`    ${paint('root', 'dim')}         ${context.root}`);
  line(`    ${paint('services', 'dim')}     ${context.config.services.length}`);
  line(`    ${paint('launch mode', 'dim')}  ${context.config.launchMode}`);

  section('Terminal');

  if (process.platform === 'darwin') {
    printAvailable('Apple Terminal automation', 'osascript');
  } else if (process.platform === 'linux' && !isWsl()) {
    printAvailable('GNOME Terminal tabs', 'gnome-terminal');
  } else {
    warning('Dev command will run services in the current terminal.');
  }
}

async function updateProject(context) {
  header(context.config);

  if (isGitRepo(context.root)) {
    section('Update Project');
    line();
    await runShell('git pull', context.root);
  } else {
    warning('Project root is not inside a git repository. Skipping git pull.');
  }

  await installServices(context);
  completionBanner('Project is up to date');
}

function showAbout(config) {
  header(config);
  section('About');
  line(`    ${style('DevPilot', 'accent', 'bold')} ${paint('· Project Management CLI', 'dim')}`);
  line();
  line(`    ${paint('version', 'dim')}  ${pkg.version}`);
  line(`    ${paint('package', 'dim')}  ${pkg.name}`);
  line(`    ${paint('author', 'dim')}   Hasibul Hasan`);
  line(`    ${paint('github', 'dim')}   ${paint('https://github.com/cbHasib', 'cyan')}`);
  line();
}

function installCommand(packageManager) {
  if (packageManager === 'npm') {
    return 'npm install';
  }

  if (packageManager === 'pnpm') {
    return 'pnpm install';
  }

  if (packageManager === 'bun') {
    return 'bun install';
  }

  return 'yarn install';
}

function runShell(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

function servicePath(context, service) {
  return path.resolve(context.root, service.dir);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function titleCase(value) {
  return String(value)
    .replace(/^@[^/]+\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultAlias(value) {
  const alias = String(value)
    .toLowerCase()
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return alias || 'project';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function appleQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [command], { stdio: 'ignore' });
  return result.status === 0;
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.error || result.status !== 0) {
    return null;
  }

  return (result.stdout || result.stderr || '').trim();
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

function packageManagerLabel(packageManager) {
  return packageManager.charAt(0).toUpperCase() + packageManager.slice(1);
}

function isWsl() {
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch (error) {
    return false;
  }
}

function isGitRepo(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  return result.status === 0 && result.stdout.trim() === 'true';
}

async function waitForEnter(message) {
  const rl = readline.createInterface({ input, output });

  try {
    await rl.question(`${message} `);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  line();
  fail(error.message);
  process.exitCode = 1;
});
