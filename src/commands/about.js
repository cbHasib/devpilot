'use strict';

const { header, section, line, paint, style } = require('../ui');
const pkg = require('../../package.json');

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

module.exports = { showAbout };
