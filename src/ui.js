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
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

function line(value = '') {
  console.log(value);
}

function rule(left, right) {
  return paint(`${left}${'─'.repeat(BANNER_WIDTH)}${right}`, 'accent');
}

function bannerRow(left, right = '') {
  const gap = BANNER_WIDTH - 2 - visibleLength(left) - visibleLength(right);
  const spacer = gap > 0 ? ' '.repeat(gap) : ' ';
  return `${paint('│', 'accent')} ${left}${spacer}${right} ${paint('│', 'accent')}`;
}

function header(config) {
  line();
  line(`  ${style(' DevPilot ', 'badge')} ${paint(`v${pkg.version}`, 'dim')}  ${paint('Project Management CLI', 'gray')}`);

  if (config) {
    const count = config.services ? config.services.length : 0;
    const meta = [
      `${paint('alias', 'gray')} ${paint(config.alias, 'dim')}`,
      paint(countLabel(count), 'dim'),
      config.packageManager ? paint(config.packageManager, 'dim') : null
    ].filter(Boolean).join(`  ${paint('·', 'gray')}  `);

    line(`  ${style('◆', 'accent')} ${style(config.projectName, 'white', 'bold')}   ${meta}`);
  }

  line(`  ${paint('─'.repeat(BANNER_WIDTH), 'gray')}`);
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
