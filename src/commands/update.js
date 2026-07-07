'use strict';

const { header, section, line, warning, completionBanner } = require('../ui');
const { runShell, isGitRepo } = require('../utils');
const { installServices } = require('./install');

async function updateProject(context) {
  header(context.config);

  if (isGitRepo(context.root)) {
    section('Update Project');
    line();
    await runShell('git pull', context.root);
  } else {
    warning('Project root is not inside a git repository. Skipping git pull.');
  }

  await installServices(context);
  completionBanner('Project is up to date');
}

module.exports = { updateProject };
