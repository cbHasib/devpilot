'use strict';

const clack = require('@clack/prompts');

const { clearScreen, header, line, paint, style, fail, waitForEnter } = require('./ui');

async function showMenu(context, runCommand) {
  while (true) {
    clearScreen();
    header(context.config);
    line();

    const action = await clack.select({
      message: 'What would you like to do?',
      options: [
        { value: 'dev', label: 'Start Development', hint: 'launch every service in its own tab' },
        { value: 'install', label: 'Install Dependencies', hint: 'install packages for all services' },
        { value: 'build', label: 'Build All Services', hint: 'run each service build script' },
        { value: 'lint', label: 'Lint All Services', hint: 'run each service lint script' },
        { value: 'clean', label: 'Clean Project', hint: 'remove node_modules, dist, and caches' },
        { value: 'doctor', label: 'Doctor', hint: 'check local tooling and configuration' },
        { value: 'update', label: 'Update Project', hint: 'pull latest changes and reinstall' },
        { value: 'about', label: 'About', hint: 'version and project links' },
        { value: 'exit', label: 'Exit', hint: 'leave DevPilot' }
      ]
    });

    if (clack.isCancel(action) || action === 'exit') {
      farewell();
      return;
    }

    clearScreen();

    try {
      await runCommand(action, context);
    } catch (error) {
      line();
      fail(error.message);
    }

    if (action === 'dev') {
      return;
    }

    line();
    await waitForEnter(`  ${paint('Press Enter to return to the menu…', 'dim')}`);
  }
}

function farewell() {
  clearScreen();
  line();
  line(`  ${style('◆', 'accent')} ${paint('See you next time.', 'dim')}`);
  line();
}

module.exports = { showMenu };
