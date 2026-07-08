'use strict';

const { spawn } = require('child_process');

const clack = require('@clack/prompts');

const pkg = require('../../package.json');
const { header, line, paint, style } = require('../ui');
const { info, success, warning } = require('../logger');
const {
  cachedUpdate,
  installCommand,
  printUpdateNotice,
  refreshCache,
  updateFromLatest
} = require('../update-check');

async function upgradeDevPilot(context, args = []) {
  const assumeYes = args.includes('--yes') || args.includes('-y');
  const skipCheck = args.includes('--skip-check');
  let update = cachedUpdate();
  let checked = false;

  header();

  if (!skipCheck) {
    const spinner = clack.spinner();
    spinner.start('Checking npm for the latest DevPilot...');

    const cache = await refreshCache({ timeoutMs: 5000 });
    checked = cache.checked;
    update = updateFromLatest(cache.latest);

    if (update) {
      spinner.stop(`DevPilot v${update.latest} is available.`);
    } else if (checked) {
      spinner.stop('DevPilot is already up to date.');
    } else {
      spinner.stop('Could not reach the npm registry.');
    }
  }

  if (!update) {
    if (!checked) {
      warning('DevPilot could not confirm the latest version right now.');

      if (!assumeYes && process.stdin.isTTY) {
        const confirmed = await clack.confirm({
          message: `Run ${installCommand()} anyway?`,
          initialValue: false
        });

        if (clack.isCancel(confirmed) || !confirmed) {
          return;
        }
      }

      await runInstall(installCommand());
      success(`DevPilot update finished. Restart the command to use the newest version.`);
      return;
    }

    info(`Current version: ${paint(`v${pkg.version}`, 'cyan')}`);
    return;
  }

  printUpdateNotice(update);

  if (!assumeYes && process.stdin.isTTY) {
    const confirmed = await clack.confirm({
      message: `Install ${update.packageName}@latest globally now?`,
      initialValue: true
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      warning(`Update skipped. Run ${paint(update.command, 'cyan')} when you're ready.`);
      return;
    }
  }

  await runInstall(update.installCommand || installCommand());
  success(`DevPilot update finished. Restart the command to use the newest version.`);
}

function runInstall(command) {
  line();
  line(`  ${style('Installing', 'white', 'bold')} ${paint(command, 'cyan')}`);
  line();

  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`DevPilot update failed with exit code ${code}. You can retry manually with: ${command}`));
    });
  });
}

module.exports = { upgradeDevPilot };
