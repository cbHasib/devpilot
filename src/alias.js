'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const clack = require('@clack/prompts');

const { ALIAS_MARKER } = require('./constants');
const { answer } = require('./prompts');
const { shellQuote } = require('./utils');

async function createGlobalAlias(alias, projectRoot) {
  const binDir = getGlobalBinDir();

  if (process.platform === 'win32') {
    return createWindowsAlias(binDir, alias, projectRoot);
  }

  return createPosixAlias(binDir, alias, projectRoot);
}

async function createPosixAlias(binDir, alias, projectRoot) {
  // The npm global bin dir is often a root-owned system path (e.g. /usr/bin
  // when Node came from the OS package manager). Fall back to a user-writable
  // directory instead of forcing the user to run setup with sudo.
  const targetDir = resolvePosixBinDir(binDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const aliasPath = path.join(targetDir, alias);
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
  await ensureOnPath(targetDir);

  return aliasPath;
}

function resolvePosixBinDir(preferred) {
  // Best case: the npm global bin dir is writable (e.g. an nvm install).
  if (isWritableDir(preferred)) {
    return preferred;
  }

  // Next best: a directory under the user's home that is already on PATH and
  // writable, so the alias works immediately without touching a shell profile.
  const home = os.homedir();
  const writableOnPath = pathDirs().find(
    (dir) => (dir === home || dir.startsWith(home + path.sep)) && isWritableDir(dir)
  );

  if (writableOnPath) {
    return writableOnPath;
  }

  // Last resort: the conventional user bin dir. We create it below and offer
  // to add it to PATH.
  return path.join(os.homedir(), '.local', 'bin');
}

function isWritableDir(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return fs.statSync(dir).isDirectory();
  } catch (error) {
    return false;
  }
}

function pathDirs() {
  return (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => path.isAbsolute(entry))
    .map((entry) => path.resolve(entry));
}

async function ensureOnPath(dir) {
  if (pathDirs().includes(path.resolve(dir))) {
    return;
  }

  const profile = shellProfile();
  const exportLine = `export PATH="${dir}:$PATH"`;

  const shouldAdd = await answer(clack.confirm({
    message: `${dir} is not on your PATH. Add it to ${profile}?`,
    initialValue: true
  }));

  if (!shouldAdd) {
    clack.log.warn(`Add it yourself:  echo '${exportLine}' >> ${profile}`);
    return;
  }

  appendToProfile(profile, exportLine);
  clack.log.success(`Added ${dir} to PATH in ${profile}.`);
  clack.log.warn(`Restart your shell or run: source ${profile}`);
}

function shellProfile() {
  const home = os.homedir();
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  }

  if (shell.includes('bash')) {
    const bashrc = path.join(home, '.bashrc');
    return fs.existsSync(bashrc) ? bashrc : path.join(home, '.profile');
  }

  return path.join(home, '.profile');
}

function appendToProfile(profile, exportLine) {
  let content = fs.existsSync(profile) ? fs.readFileSync(profile, 'utf8') : '';

  if (content.includes(exportLine)) {
    return;
  }

  if (content && !content.endsWith('\n')) {
    content += '\n';
  }

  content += `\n# ${ALIAS_MARKER} PATH\n${exportLine}\n`;
  fs.writeFileSync(profile, content);
}

async function createWindowsAlias(binDir, alias, projectRoot) {
  fs.mkdirSync(binDir, { recursive: true });

  const cliPath = cliEntryPath();

  const cmdPath = path.join(binDir, `${alias}.cmd`);
  const cmdContent = [
    '@echo off',
    `REM ${ALIAS_MARKER}. Do not edit by hand.`,
    `node "${cliPath}" --project "${projectRoot}" %*`,
    ''
  ].join('\r\n');

  const wroteCmd = await writeAliasFile(cmdPath, cmdContent);

  if (!wroteCmd) {
    return null;
  }

  // Git Bash / MSYS shells do not resolve `.cmd` files from a bare command
  // name (they only auto-append `.exe`), so also write an extension-less
  // POSIX shim next to it. Forward-slash paths keep the shell happy and node
  // on Windows accepts them.
  const shimPath = path.join(binDir, alias);
  const shimContent = [
    '#!/bin/sh',
    `# ${ALIAS_MARKER}. Do not edit by hand.`,
    `exec node "${toPosixPath(cliPath)}" --project "${toPosixPath(projectRoot)}" "$@"`,
    ''
  ].join('\n');

  await writeAliasFile(shimPath, shimContent);

  return cmdPath;
}

function toPosixPath(value) {
  return String(value).replace(/\\/g, '/');
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
    // On Windows `npm` is `npm.cmd`, which cannot be spawned without a shell.
    // Without this the lookup throws and falls back to the Node install dir
    // (e.g. C:\Program Files\nodejs), which needs admin rights to write to.
    const prefix = execFileSync('npm', ['prefix', '-g'], {
      encoding: 'utf8',
      shell: process.platform === 'win32'
    }).trim();
    return process.platform === 'win32' ? prefix : path.join(prefix, 'bin');
  } catch (error) {
    return path.dirname(process.execPath);
  }
}

module.exports = { createGlobalAlias };
