'use strict';

const { header, section, line, paint, style, padVisible } = require('../ui');
const pkg = require('../../package.json');

function showAbout(config) {
  const repoUrl = String(pkg.homepage || '').replace(/#.*$/, '');
  const issuesUrl = (pkg.bugs && pkg.bugs.url) || `${repoUrl}/issues`;
  const npmUrl = `https://www.npmjs.com/package/${pkg.name}`;

  header(config);

  section('About');
  line(`    ${style('DevPilot', 'accent', 'bold')} ${paint(`v${pkg.version}`, 'dim')} ${paint('·', 'gray')} ${paint(`${pkg.license} license`, 'dim')}`);
  line(`    ${paint(pkg.description, 'gray')}`);

  section('Author');
  line(`    ${style('Hasibul Hasan', 'white', 'bold')}`);
  row('github', link('https://github.com/cbHasib'));
  row('npm', link('https://www.npmjs.com/~cbhasib'));
  row('website', link('https://hasib.me'));

  section('Links');
  row('repository', link(repoUrl));
  row('package', link(npmUrl));
  row('issues', link(issuesUrl));

  section('Update');
  row('install', style(`npm install -g ${pkg.name}@latest`, 'cyan', 'bold'));
  row('node', paint(process.version, 'dim'));
  line();
}

function row(label, value) {
  line(`    ${paint(padVisible(label, 12), 'gray')}${value}`);
}

function link(url) {
  return paint(url, 'cyan');
}

module.exports = { showAbout };
