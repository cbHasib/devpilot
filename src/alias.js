'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const clack = require('@clack/prompts');

const { ALIAS_MARKER } = require('./constants');
const { answer } = require('./prompts');
const { shellQuote } = require('./utils');

async function createGlobalAlias(alias, projectRoot) {
  const binDir = getGlobalBinDir();
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    return createWindowsAlias(binDir, alias, projectRoot);
  }

  return createPosixAlias(binDir, alias, projectRoot);
}

async function createPosixAlias(binDir, alias, projectRoot) {
  const aliasPath = path.join(binDir, alias);
  const cliPath = cliEntryPath();
  const content = [
    '#!/usr/bin/env bash',
    `# ${ALIAS_MARKER}. Do not edit by hand.`,
    `exec node ${shellQuote(cliPath)} --project ${shellQuote(projectRoot)} "$@"`,
    ''
  ].join('\n');

  const wroteAlias = await writeAliasFile(aliasPath, content);

  if (!wroteAlias) {
    return null;
  }

  fs.chmodSync(aliasPath, 0o755);

  return aliasPath;
}

async function createWindowsAlias(binDir, alias, projectRoot) {
  const aliasPath = path.join(binDir, `${alias}.cmd`);
  const cliPath = cliEntryPath();
  const content = [
    '@echo off',
    `REM ${ALIAS_MARKER}. Do not edit by hand.`,
    `node "${cliPath}" --project "${projectRoot}" %*`,
    ''
  ].join('\r\n');

  const wroteAlias = await writeAliasFile(aliasPath, content);

  if (!wroteAlias) {
    return null;
  }

  return aliasPath;
}

async function writeAliasFile(aliasPath, content) {
  if (fs.existsSync(aliasPath)) {
    const existing = fs.readFileSync(aliasPath, 'utf8');

    if (!existing.includes(ALIAS_MARKER)) {
      const overwrite = await answer(clack.confirm({
        message: `${aliasPath} already exists. Overwrite it?`,
        initialValue: false
      }));

      if (!overwrite) {
        clack.log.warn('Skipped alias creation.');
        return false;
      }
    }
  }

  fs.writeFileSync(aliasPath, content);
  return true;
}

function cliEntryPath() {
  return fs.realpathSync(path.join(__dirname, '..', 'bin', 'devpilot.js'));
}

function getGlobalBinDir() {
  try {
    const prefix = execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8' }).trim();
    return process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
  } catch (error) {
    return path.dirname(process.execPath);
  }
}

module.exports = { createGlobalAlias };
