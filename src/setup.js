'use strict';

const path = require('path');

const clack = require('@clack/prompts');

const pkg = require('../package.json');
const { CONFIG_FILE, STATE_DIR } = require('./constants');
const { clearScreen, header, line, paint, style } = require('./ui');
const { info, success, warning } = require('./logger');
const {
  titleCase,
  defaultAlias,
  packageManagerLabel,
  detectLaunchMode,
  detectTerminal,
  commandExists
} = require('./utils');
const { writeConfig, ensureGitignore } = require('./config');
const {
  cleanService,
  detectServices,
  detectPackageManagerInfo,
  scriptCommand
} = require('./services');
const { createGlobalAlias } = require('./alias');
const { answer, requiredField } = require('./prompts');
const { detectWorkspace } = require('./workspace/detector');
const { workspaceLabel } = require('./workspace/summary');
const { recommendedProfiles } = require('./profiles/manager');

async function setupProject() {
  const root = process.cwd();

  clearScreen();
  header();
  line();

  clack.intro(`Setting up DevPilot in ${paint(root, 'cyan')}`);
  const detection = detectWorkspace(root);
  printSetupDetections(detection);

  const defaultName = titleCase(path.basename(root));
  const projectName = await answer(clack.text({
    message: 'Project display name',
    placeholder: defaultName,
    defaultValue: defaultName
  }));

  const aliasDefault = defaultAlias(projectName || path.basename(root));
  const alias = await answer(clack.text({
    message: 'Command alias',
    placeholder: aliasDefault,
    defaultValue: aliasDefault,
    validate(value) {
      const candidate = String(value || '').trim() || aliasDefault;

      if (candidate === 'devpilot') {
        return 'Alias cannot be "devpilot" because that is the package command.';
      }

      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(candidate)) {
        return 'Use letters, numbers, underscores, or hyphens. Start with a letter.';
      }
    }
  }));

  const packageManager = await choosePackageManager(root, detection);
  const launchMode = chooseLaunchMode();
  const editor = await chooseEditor();

  const detectedServices = detectServices(root, packageManager);
  let services = detectedServices;

  if (detectedServices.length > 0) {
    success('Workspace imported.');
  }

  if (services.length > 0) {
    const review = await answer(clack.confirm({
      message: 'Review detected services?',
      initialValue: false
    }));

    if (review) {
      services = await reviewDetectedServices(detectedServices);
    }
  }

  while (services.length === 0 || await answer(clack.confirm({ message: 'Add another service manually?', initialValue: false }))) {
    services.push(await promptService(packageManager));
  }

  const assignColors = await answer(clack.confirm({
    message: 'Choose a terminal tab color for each service? (used by Windows Terminal)',
    initialValue: false
  }));

  if (assignColors) {
    for (let index = 0; index < services.length; index += 1) {
      const label = services[index].name || services[index].dir;
      const color = await promptColor(services[index].color, label);
      services[index] = { ...services[index], color };
    }
  }

  const profiles = await chooseRecommendedProfiles(services);

  const config = {
    schemaVersion: 1,
    projectName,
    alias,
    packageManager,
    launchMode,
    editor,
    services,
    createdAt: new Date().toISOString(),
    lastUpdated: '',
    devpilotVersion: pkg.version,
    workspace: detection.workspace,
    features: {},
    profiles,
    hooks: {}
  };

  writeConfig(root, config);
  ensureGitignore(root);

  const shouldCreateAlias = await answer(clack.confirm({
    message: `Create global command alias "${alias}"?`,
    initialValue: true
  }));
  let aliasPath = null;

  if (shouldCreateAlias) {
    try {
      aliasPath = await createGlobalAlias(alias, root);
    } catch (error) {
      warning(`Could not create the global alias: ${error.message}`);
      warning(`Run "${alias}" via "devpilot" for now, or re-run setup from an elevated terminal.`);
    }
  }

  printWorkspaceSummary(config, aliasPath);
  clack.outro(`Try ${paint(`${alias} dev`, 'cyan')} or ${paint('devpilot', 'cyan')}.`);
}

function printSetupDetections(detection) {
  const terminal = detectTerminal();

  if (detection.git.initialized) {
    success('Detected Git repository.');
  } else {
    info('No Git repository detected. The update command will skip git pull.');
  }

  if (detection.workspace.source) {
    success(`${workspaceLabel(detection.workspace)} detected.`);
  }

  if (detection.services.length > 0) {
    success(`${detection.services.length} services found.`);
  }

  if (detection.packageManager.detected) {
    success(`Package manager: ${packageManagerLabel(detection.packageManager.value)}.`);
  }

  info(`Detected terminal: ${terminal.name}.`);
}

async function choosePackageManager(root, detection) {
  const detected = detection.packageManager || detectPackageManagerInfo(root);

  if (detected.detected) {
    return detected.value;
  }

  return answer(clack.select({
    message: detected.detected ? 'Package manager' : 'Package manager',
    options: [
      { value: 'yarn', label: 'yarn' },
      { value: 'npm', label: 'npm' },
      { value: 'pnpm', label: 'pnpm' },
      { value: 'bun', label: 'bun' }
    ],
    initialValue: detected.value
  }));
}

function chooseLaunchMode() {
  const detected = detectLaunchMode();
  const label = detected === 'tabs' ? 'terminal tabs' : 'current terminal';
  success(`Launch mode: ${label}.`);
  return detected;
}

async function chooseEditor() {
  if (commandExists('code')) {
    success('Editor command: code.');
    return 'code';
  }

  return answer(clack.text({
    message: 'Editor command',
    placeholder: 'code',
    defaultValue: 'code',
    initialValue: 'code'
  }));
}

function printWorkspaceSummary(config, aliasPath) {
  const summary = [
    'Project',
    config.projectName,
    '',
    'Workspace',
    workspaceLabel(config.workspace),
    '',
    'Package Manager',
    packageManagerLabel(config.packageManager),
    '',
    'Services',
    String(config.services.length),
    '',
    'Profiles',
    String(Object.keys(config.profiles || {}).length),
    '',
    'Alias',
    config.alias,
    '',
    'Commands',
    [config.alias, `${config.alias} dev`, `${config.alias} status`].join('\n'),
    '',
    `Wrote ${CONFIG_FILE}`,
    `Updated .gitignore with ${CONFIG_FILE} and ${STATE_DIR}/`,
    aliasPath ? `Created alias: ${aliasPath}` : null
  ].filter((value) => value !== null).join('\n');

  clack.note(summary, 'Workspace Ready');
}

async function chooseRecommendedProfiles(services) {
  const profiles = recommendedProfiles(services);
  const names = Object.keys(profiles);

  if (names.length === 0) {
    return {};
  }

  const create = await answer(clack.confirm({
    message: 'Create workspace profiles automatically?',
    initialValue: true
  }));

  if (!create) {
    return {};
  }

  success(`Profiles: ${names.map(titleCase).join(', ')}.`);
  return profiles;
}

async function reviewDetectedServices(detectedServices) {
  const chosen = await answer(clack.multiselect({
    message: 'Select the services DevPilot should manage',
    options: detectedServices.map((service, index) => ({
      value: index,
      label: service.name,
      hint: service.framework ? `${service.dir} · ${service.framework}` : service.dir
    })),
    initialValues: detectedServices.map((service, index) => index),
    required: false
  }));
  const services = chosen
    .sort((a, b) => a - b)
    .map((index) => detectedServices[index]);
  const editCommands = await answer(clack.confirm({
    message: 'Edit commands for selected services?',
    initialValue: false
  }));

  if (!editCommands) {
    return services;
  }

  const edited = [];

  for (const service of services) {
    edited.push(await editService(service));
  }

  return edited;
}

async function editService(service) {
  clack.log.step(`Configure ${style(service.dir, 'white', 'bold')}`);

  const dir = await answer(clack.text({ message: 'Service folder', initialValue: service.dir, validate: requiredField }));
  const name = await answer(clack.text({ message: 'Service name', initialValue: service.name }));
  const dev = await answer(clack.text({ message: 'Dev command', initialValue: service.dev, placeholder: 'leave empty to skip' }));
  const build = await answer(clack.text({ message: 'Build command', initialValue: service.build, placeholder: 'leave empty to skip' }));
  const lint = await answer(clack.text({ message: 'Lint command', initialValue: service.lint, placeholder: 'leave empty to skip' }));

  return cleanService({
    dir,
    name,
    dev,
    build,
    lint,
    color: service.color,
    framework: service.framework,
    port: service.port
  });
}

async function promptService(packageManager) {
  clack.log.step('Add a service');

  const dir = await answer(clack.text({ message: 'Service folder', placeholder: 'e.g. backend', validate: requiredField }));
  const name = await answer(clack.text({ message: 'Service name', initialValue: titleCase(path.basename(dir)) }));
  const dev = await answer(clack.text({ message: 'Dev command', initialValue: scriptCommand(packageManager, 'dev'), placeholder: 'leave empty to skip' }));
  const build = await answer(clack.text({ message: 'Build command', initialValue: scriptCommand(packageManager, 'build'), placeholder: 'leave empty to skip' }));
  const lint = await answer(clack.text({ message: 'Lint command', initialValue: scriptCommand(packageManager, 'lint'), placeholder: 'leave empty to skip' }));

  return cleanService({ dir, name, dev, build, lint });
}

async function promptColor(current, label) {
  return answer(clack.select({
    message: label ? `Tab color for ${label}` : 'Terminal tab color',
    options: [
      { value: '', label: 'Auto', hint: 'assign a distinct color by position' },
      { value: '#2563eb', label: 'Blue' },
      { value: '#16a34a', label: 'Green' },
      { value: '#db2777', label: 'Pink' },
      { value: '#d97706', label: 'Amber' },
      { value: '#7c3aed', label: 'Purple' },
      { value: '#0891b2', label: 'Cyan' },
      { value: '#dc2626', label: 'Red' },
      { value: '#4b5563', label: 'Gray' }
    ],
    initialValue: current || ''
  }));
}

module.exports = { setupProject };
