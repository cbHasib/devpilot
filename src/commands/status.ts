'use strict';

const { header, section, line, paint, padVisible } = require('../ui');
const { packageManagerLabel } = require('../utils');
const { detectWorkspace } = require('../workspace/detector');
const { workspaceLabel } = require('../workspace/summary');
const { statusLabel, statusMark, workspaceStatus } = require('../runtime/status');

async function showStatus(context) {
  const detection = detectWorkspace(context.root);
  const statuses = workspaceStatus(context);
  const running = statuses.filter((item) => item.status === 'running');

  header(context.config);

  section('Workspace Status');

  if (statuses.length === 0) {
    line(`    ${paint('No services configured', 'dim')}`);
  }

  statuses.forEach((item) => {
    const mark = paint(statusMark(item.status), item.status === 'running' ? 'green' : item.status === 'unknown' ? 'yellow' : 'red');
    const port = item.entry && item.entry.port ? paint(` localhost:${item.entry.port}`, 'dim') : '';
    line(`    ${padVisible(item.service.name || item.service.dir, 18)} ${mark} ${statusLabel(item.status)}${port}`);
  });

  section('Started');
  line(`    ${running.length} of ${statuses.length} services`);

  section('Running Time');
  statuses.forEach((item) => {
    line(`    ${padVisible(item.service.name || item.service.dir, 18)} ${item.uptime || paint('-', 'dim')}`);
  });

  section('Package Manager');
  line(`    ${packageManagerLabel(context.config.packageManager)}`);

  section('Workspace');
  line(`    ${workspaceLabel(context.config.workspace.type ? context.config.workspace : detection.workspace)}`);
}

module.exports = { showStatus };
