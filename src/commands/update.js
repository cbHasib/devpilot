'use strict';

const { header, section, completionBanner } = require('../ui');
const { info, success, warning } = require('../logger');
const { runShell, isGitRepo } = require('../utils');
const { installServices } = require('./install');

async function updateProject(context) {
  header(context.config);

  if (isGitRepo(context.root)) {
    section('Update Project');
    info('Pulling latest changes...');
    await runShell('git pull', context.root);
    success('Latest changes pulled.');
  } else {
    section('Update Project');
    warning('Project root is not inside a git repository. Skipping git pull.');
    info('Run git init if this workspace should be updated through Git.');
  }

  info('Installing dependencies...');
  await installServices(context, { showCompletion: false });
  completionBanner('Completed.');
}

module.exports = { updateProject };
