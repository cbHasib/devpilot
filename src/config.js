'use strict';

const fs = require('fs');
const path = require('path');

const { CONFIG_FILE, STATE_DIR } = require('./constants');
const { readJson } = require('./utils');

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

module.exports = { loadProjectContext, findConfigRoot, writeConfig, ensureGitignore };
