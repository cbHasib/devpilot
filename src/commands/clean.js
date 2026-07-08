'use strict';

const fs = require('fs');
const path = require('path');

const { header, section, completionBanner } = require('../ui');
const { info, success, warning } = require('../logger');
const { servicePath } = require('../utils');

function cleanProject(context) {
  const targets = ['node_modules', 'dist', '.next', 'coverage'];
  header(context.config);

  context.config.services.forEach((service) => {
    section(`Clean: ${service.name}`);
    const root = servicePath(context, service);
    let removed = 0;

    if (!fs.existsSync(root)) {
      warning(`Cannot find ${service.dir}/.`);
      info('Check your configuration or run devpilot setup.');
      return;
    }

    targets.forEach((target) => {
      const fullPath = path.join(root, target);

      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        success(`Removed ${service.dir}/${target}`);
        removed += 1;
      }
    });

    if (removed === 0) {
      info('Nothing to remove.');
    }
  });

  completionBanner('Clean complete');
}

module.exports = { cleanProject };
