'use strict';

const clack = require('@clack/prompts');

const { writeConfig } = require('../config');
const { header, section, line, paint, style } = require('../ui');
const { info, success, warning } = require('../logger');
const { answer, requiredField } = require('../prompts');
const { selectOption } = require('../search-select');
const {
  envToInput,
  findProfile,
  listProfiles,
  parseEnvInput,
  profileServiceTokens,
  serializeProfile,
  tokenKey
} = require('../profiles/manager');

async function listWorkspaceProfiles(context) {
  header(context.config);
  section('Workspace Profiles');
  printProfiles(context);
}

async function manageProfile(context, args = []) {
  const action = args[0] || 'list';

  if (action === 'list' || action === 'ls') {
    await listWorkspaceProfiles(context);
    return;
  }

  if (action === 'create' || action === 'add') {
    await createProfile(context, args[1]);
    return;
  }

  if (action === 'edit') {
    await editProfile(context, args[1]);
    return;
  }

  if (action === 'delete' || action === 'remove' || action === 'rm') {
    await deleteProfile(context, args[1]);
    return;
  }

  header(context.config);
  warning(`Unknown profile action: ${action}`);
  info('Use profile create, profile edit, profile delete, or profiles.');
}

async function createProfile(context, initialName) {
  header(context.config);
  section('Create Profile');

  const name = await answer(clack.text({
    message: 'Profile name',
    placeholder: 'Frontend',
    defaultValue: initialName || '',
    initialValue: initialName || '',
    validate: requiredField
  }));
  const id = profileId(name);

  if (findProfile(context.config, id)) {
    warning(`Profile "${name}" already exists.`);
    return;
  }

  const definition = await promptProfileDefinition(context);

  if (!definition) {
    return;
  }

  writeProfile(context, id, definition);
  success(`Profile "${name}" created.`);
}

async function editProfile(context, target) {
  header(context.config);
  section('Edit Profile');

  const profile = await chooseProfile(context, target);

  if (!profile) {
    return;
  }

  const definition = await promptProfileDefinition(context, profile);

  if (!definition) {
    return;
  }

  writeProfile(context, profile.id, definition);
  success(`Profile "${profile.name}" updated.`);
}

async function deleteProfile(context, target) {
  header(context.config);
  section('Delete Profile');

  const profile = await chooseProfile(context, target);

  if (!profile) {
    return;
  }

  const confirmed = await answer(clack.confirm({
    message: `Delete profile "${profile.name}"?`,
    initialValue: false
  }));

  if (!confirmed) {
    warning('Profile deletion cancelled.');
    return;
  }

  const profiles = { ...(context.config.profiles || {}) };
  delete profiles[profile.id];
  writeConfig(context.root, { ...writeableConfig(context), profiles });
  success(`Profile "${profile.name}" deleted.`);
}

function printProfiles(context) {
  const profiles = listProfiles(context.config);

  if (profiles.length === 0) {
    warning('No profiles configured.');
    info(`Run ${paint('devpilot profile create', 'cyan')} to add one.`);
    return;
  }

  profiles.forEach((profile) => {
    const services = profile.services.includes('*') ? ['all services'] : profile.services;
    line(`    ${style(profile.name, 'white', 'bold')} ${paint(`(${profile.id})`, 'dim')}`);
    line(`      ${paint('services', 'dim')} ${services.join(', ') || paint('none', 'dim')}`);

    const env = Object.keys(profile.env || {});

    if (env.length > 0) {
      line(`      ${paint('env', 'dim')}      ${env.join(', ')}`);
    }
  });
}

async function chooseProfile(context, target) {
  const profiles = listProfiles(context.config);

  if (profiles.length === 0) {
    warning('No profiles configured.');
    info(`Run ${paint('devpilot profile create', 'cyan')} to add one.`);
    return null;
  }

  if (target) {
    const profile = findProfile(context.config, target);

    if (!profile) {
      warning(`Profile not found: ${target}`);
      return null;
    }

    return profile;
  }

  const choice = await selectOption({
    message: 'Choose profile',
    options: profiles.map((profile) => ({
      value: profile.id,
      label: profile.name,
      hint: profileServiceTokens(profile).join(', ') || 'no services'
    }))
  });

  if (clack.isCancel(choice) || choice === null) {
    return null;
  }

  return findProfile(context.config, choice);
}

async function promptProfileDefinition(context, profile = null) {
  const services = context.allServices || context.config.services || [];

  if (services.length === 0) {
    warning('No services are configured.');
    return null;
  }

  const existingTokens = profile ? profileServiceTokens(profile) : [];
  const initialValues = existingTokens.includes('*')
    ? services.map((service) => service.dir)
    : services
      .filter((service) => existingTokens.some((token) => tokenKey(token) === tokenKey(service.dir) || tokenKey(token) === tokenKey(service.name)))
      .map((service) => service.dir);

  const selected = await answer(clack.multiselect({
    message: 'Services in this profile',
    options: services.map((service) => ({
      value: service.dir,
      label: service.name || service.dir,
      hint: service.framework ? `${service.dir} · ${service.framework}` : service.dir
    })),
    initialValues,
    required: true
  }));

  const envInput = await answer(clack.text({
    message: 'Environment variables',
    placeholder: 'NODE_ENV=development, API_URL=http://localhost:3000',
    initialValue: profile ? envToInput(profile.env) : ''
  }));

  return serializeProfile(selected, parseEnvInput(envInput));
}

function writeProfile(context, id, definition) {
  const profiles = { ...(context.config.profiles || {}) };
  profiles[id] = definition;
  writeConfig(context.root, { ...writeableConfig(context), profiles });
}

function writeableConfig(context) {
  const config = {
    ...context.config,
    services: context.allServices || context.config.services || []
  };

  delete config.activeProfile;
  return config;
}

function profileId(value) {
  const id = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return id || 'profile';
}

module.exports = {
  listWorkspaceProfiles,
  manageProfile
};
