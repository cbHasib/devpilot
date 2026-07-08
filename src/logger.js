'use strict';

const { line, paint } = require('./ui');

function info(message) {
  line(`  ${paint('>', 'accent')} ${message}`);
}

function success(message) {
  line(`  ${paint('✓', 'green')} ${message}`);
}

function warning(message) {
  line(`  ${paint('▲', 'yellow')} ${message}`);
}

function error(message) {
  line(`  ${paint('✗', 'red')} ${message}`);
}

function debug(message) {
  if (!process.env.DEVPILOT_DEBUG) {
    return;
  }

  line(`  ${paint('•', 'gray')} ${paint(message, 'dim')}`);
}

module.exports = { info, success, warning, error, debug };
