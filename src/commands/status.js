'use strict';

const net = require('net');

const { header, section, line, paint, padVisible } = require('../ui');
const { packageManagerLabel } = require('../utils');
const { detectWorkspace } = require('../workspace/detector');
const { workspaceLabel } = require('../workspace/summary');

async function showStatus(context) {
  const detection = detectWorkspace(context.root);
  const services = context.config.services || [];

  header(context.config);

  section('Workspace');

  if (services.length === 0) {
    line(`    ${paint('No services configured', 'dim')}`);
  }

  for (const service of services) {
    const state = await serviceState(service);
    const framework = service.framework ? paint(` ${service.framework}`, 'dim') : '';
    line(`    ${padVisible(service.name || service.dir, 18)} ${state.mark} ${state.label}${framework}`);
  }

  section('Package Manager');
  line(`    ${packageManagerLabel(context.config.packageManager)}`);

  section('Workspace');
  line(`    ${workspaceLabel(context.config.workspace.type ? context.config.workspace : detection.workspace)}`);
}

async function serviceState(service) {
  if (!service.port) {
    return { label: 'Unknown', mark: paint('?', 'yellow') };
  }

  const running = await isPortOpen(service.port);

  if (running) {
    return { label: `Running :${service.port}`, mark: paint('✓', 'green') };
  }

  return { label: `Stopped :${service.port}`, mark: paint('✗', 'red') };
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = (running) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(running);
    };

    socket.setTimeout(300);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

module.exports = { showStatus };
