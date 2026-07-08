'use strict';

const clack = require('@clack/prompts');

async function confirmStopServices() {
  if (!process.stdin.isTTY) {
    return true;
  }

  const answer = await clack.confirm({
    message: 'Stop all running services?',
    initialValue: true
  });

  if (clack.isCancel(answer)) {
    return true;
  }

  return Boolean(answer);
}

module.exports = { confirmStopServices };
