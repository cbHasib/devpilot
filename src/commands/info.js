'use strict';

const pkg = require('../../package.json');
const { header, section, line, paint } = require('../ui');
const { packageManagerLabel } = require('../utils');
const { detectWorkspace } = require('../workspace/detector');
const { serviceFrameworks, workspaceLabel } = require('../workspace/summary');

function showInfo(context) {
  const detection = detectWorkspace(context.root);
  const workspace = context.config.workspace.type ? context.config.workspace : detection.workspace;
  const frameworks = serviceFrameworks(context.config.services);

  header(context.config);

  section('Project');
  line(`    ${context.config.projectName}`);

  section('Root');
  line(`    ${context.root}`);

  section('Frameworks');
  if (frameworks.length === 0) {
    line(`    ${paint('Unknown', 'dim')}`);
  } else {
    frameworks.forEach((framework) => line(`    ${framework}`));
  }

  section('Package Manager');
  line(`    ${packageManagerLabel(context.config.packageManager)}`);

  section('Workspace');
  line(`    ${workspaceLabel(workspace)}`);

  section('Services');
  line(`    ${context.config.services.length}`);

  section('DevPilot');
  line(`    v${pkg.version}`);
}

module.exports = { showInfo };
