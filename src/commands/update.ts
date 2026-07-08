'use strict';

const { header, section, completionBanner } = require('../ui');
const { info, success, warning } = require('../logger');
const { runShell, isGitRepo } = require('../utils');
const { installServices } = require('./install');
const { createTimer } = require('../workspace/summary');

async function updateProject(context) {
  const timer = createTimer();
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
  info(timer.label());
}

module.exports = { updateProject };
