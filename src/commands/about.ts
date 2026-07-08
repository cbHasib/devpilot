'use strict';

const os = require('os');
const path = require('path');

const { header, section, line, paint, style, padVisible } = require('../ui');
const { CONFIG_FILE } = require('../constants');
const { platformLabel } = require('../utils');
const pkg = require('../../package.json');

function showAbout(context) {
  const config = context.config || context;
  const repoUrl = String(pkg.homepage || '').replace(/#.*$/, '');
  const issuesUrl = (pkg.bugs && pkg.bugs.url) || `${repoUrl}/issues`;
  const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;
  const repository = pkg.repository && pkg.repository.url
    ? pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
    : repoUrl;

  header(config);

  section('DevPilot');
  row('version', style(pkg.version, 'white', 'bold'));
  row('author', pkg.author || 'Unknown');
  row('github', link(repository));
  row('homepage', link(pkg.homepage || repoUrl));
  row('license', pkg.license || 'Unknown');
  row('node', process.version);
  row('os', `${platformLabel()} ${os.release()}`);
  row('config', context.root ? path.join(context.root, CONFIG_FILE) : 'Not loaded');
  row('package', link(npmUrl));
  row('issues', link(issuesUrl));

  section('Philosophy');
  principle('Configure once', 'one .devpilot.json describes the whole workspace.');
  principle('Zero lock-in', 'a thin layer over the scripts your services already have.');
  principle('One entry point', 'dev, install, build, lint, clean, and doctor for every service.');
  principle('Stay out of the way', 'no daemons, no state beyond a small config file.');

  section('Update');
  row('install', style(`npm install -g ${pkg.name}@latest`, 'cyan', 'bold'));
  line();
}

function row(label, value) {
  line(`    ${paint(padVisible(label, 12), 'gray')}${value}`);
}

function principle(title, text) {
  line(`    ${paint('·', 'accent')} ${style(title, 'white', 'bold')}`);
  line(`      ${paint(text, 'gray')}`);
}

function link(url) {
  return paint(url, 'cyan');
}

module.exports = { showAbout };
