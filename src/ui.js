'use strict';

const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

const pkg = require('../package.json');

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
  badge: '\x1b[48;5;173m\x1b[38;5;235m\x1b[1m',
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
    // 2J clears the visible screen, 3J wipes scrollback so nothing lingers.
    process.stdout.write('\x1b[H\x1b[2J\x1b[3J');
  }
}

function line(value = '') {
  console.log(value);
}

function rule(left, right) {
  return style(`${left}${'━'.repeat(BANNER_WIDTH)}${right}`, 'accent', 'bold');
}

function bannerRow(left, right = '') {
  const gap = BANNER_WIDTH - 2 - visibleLength(left) - visibleLength(right);
  const spacer = gap > 0 ? ' '.repeat(gap) : ' ';
  const edge = style('┃', 'accent', 'bold');
  return `${edge} ${left}${spacer}${right} ${edge}`;
}

function header(config) {
  line();
  line(rule('┏', '┓'));
  line(bannerRow(''));
  line(bannerRow(`  ${style('✻', 'accent')} ${style('DevPilot', 'white', 'bold')} ${paint(`v${pkg.version}`, 'dim')}`));
  line(bannerRow(`    ${paint('Project management for multi-service workspaces', 'gray')}`));
  line(bannerRow(''));

  if (config) {
    const count = config.services ? config.services.length : 0;
    const services = config.packageManager
      ? `${paint(String(count), 'white')} ${paint('·', 'gray')} ${paint(config.packageManager, 'white')}`
      : paint(String(count), 'white');

    line(bannerRow(paint(`  ${'─'.repeat(BANNER_WIDTH - 6)}`, 'gray')));
    line(bannerRow(''));
    headerRow('project', style(config.projectName, 'white', 'bold'));
    headerRow('services', services);
    headerRow('alias', paint(config.alias, 'white'));
    line(bannerRow(''));
  }

  line(rule('┗', '┛'));
}

function headerRow(label, value) {
  line(bannerRow(`  ${paint(padVisible(label, 11), 'gray')}${value}`));
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

function completionBanner(message) {
  line();
  line(`  ${paint('✓', 'green')} ${style(message, 'green', 'bold')}`);
}

function countLabel(count) {
  return `${count} ${count === 1 ? 'service' : 'services'}`;
}

async function waitForEnter(message) {
  const rl = readline.createInterface({ input, output });

  try {
    await rl.question(`${message} `);
  } finally {
    rl.close();
  }
}

module.exports = {
  paint,
  style,
  visibleLength,
  padVisible,
  clearScreen,
  line,
  rule,
  bannerRow,
  header,
  section,
  success,
  warning,
  fail,
  info,
  completionBanner,
  countLabel,
  waitForEnter
};
