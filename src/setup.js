'use strict';

const path = require('path');

const clack = require('@clack/prompts');

const { CONFIG_FILE, STATE_DIR } = require('./constants');
const { clearScreen, header, line, paint, style } = require('./ui');
const { titleCase, defaultAlias } = require('./utils');
const { writeConfig, ensureGitignore } = require('./config');
const { cleanService, detectServices, detectPackageManager, scriptCommand } = require('./services');
const { createGlobalAlias } = require('./alias');
const { answer, requiredField } = require('./prompts');

async function setupProject() {
  const root = process.cwd();

  clearScreen();
  header();
  line();

  clack.intro(`Setting up DevPilot in ${paint(root, 'cyan')}`);

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

  const packageManager = await answer(clack.select({
    message: 'Package manager',
    options: [
      { value: 'yarn', label: 'yarn' },
      { value: 'npm', label: 'npm' },
      { value: 'pnpm', label: 'pnpm' },
      { value: 'bun', label: 'bun' }
    ],
    initialValue: detectPackageManager(root)
  }));

  const launchMode = await answer(clack.select({
    message: 'Development launch mode',
    options: [
      { value: 'tabs', label: 'Terminal tabs', hint: 'open each service in its own tab' },
      { value: 'current', label: 'Current terminal', hint: 'run every service in this terminal' }
    ],
    initialValue: 'tabs'
  }));

  const detectedServices = detectServices(root, packageManager);
  let services = [];

  if (detectedServices.length > 0) {
    const chosen = await answer(clack.multiselect({
      message: 'Select the services DevPilot should manage',
      options: detectedServices.map((service, index) => ({
        value: index,
        label: service.dir,
        hint: service.name
      })),
      initialValues: detectedServices.map((service, index) => index),
      required: false
    }));

    services = chosen
      .sort((a, b) => a - b)
      .map((index) => detectedServices[index]);
  }

  if (services.length > 0) {
    const review = await answer(clack.confirm({
      message: 'Edit the detected commands for each service?',
      initialValue: false
    }));

    if (review) {
      const edited = [];

      for (const service of services) {
        edited.push(await editService(service));
      }

      services = edited;
    }
  }

  while (services.length === 0 || await answer(clack.confirm({ message: 'Add another service manually?', initialValue: false }))) {
    services.push(await promptService(packageManager));
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

  const shouldCreateAlias = await answer(clack.confirm({
    message: `Create global command alias "${alias}"?`,
    initialValue: true
  }));
  let aliasPath = null;

  if (shouldCreateAlias) {
    aliasPath = await createGlobalAlias(alias, root);
  }

  const summary = [
    `Wrote ${CONFIG_FILE}`,
    `Updated .gitignore with ${CONFIG_FILE} and ${STATE_DIR}/`,
    aliasPath ? `Created alias: ${aliasPath}` : null
  ].filter(Boolean).join('\n');

  clack.note(summary, 'Done');
  clack.outro(`Try ${paint(`${alias} dev`, 'cyan')} or ${paint('devpilot', 'cyan')}.`);
}

async function editService(service) {
  clack.log.step(`Configure ${style(service.dir, 'white', 'bold')}`);

  const dir = await answer(clack.text({ message: 'Service folder', initialValue: service.dir, validate: requiredField }));
  const name = await answer(clack.text({ message: 'Service name', initialValue: service.name }));
  const dev = await answer(clack.text({ message: 'Dev command', initialValue: service.dev, placeholder: 'leave empty to skip' }));
  const build = await answer(clack.text({ message: 'Build command', initialValue: service.build, placeholder: 'leave empty to skip' }));
  const lint = await answer(clack.text({ message: 'Lint command', initialValue: service.lint, placeholder: 'leave empty to skip' }));

  return cleanService({ dir, name, dev, build, lint });
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

module.exports = { setupProject };
