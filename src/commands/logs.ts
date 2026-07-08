'use strict';

const { header, section } = require('../ui');
const { info, success, warning } = require('../logger');
const {
  clearServiceLog,
  clearWorkspaceLogs,
  followLogs,
  followWorkspaceLogs
} = require('../runtime/logs');
const { targetServices } = require('./stop');

const CLEAR_ARGS = new Set(['clear', '--clear', '-c']);

async function showLogs(context, args = []) {
  const request = parseLogArgs(args);
  const target = request.target;
  const services = targetServices(context, target);

  header(context.config);
  section(sectionTitle(request.clear, target));

  if (request.clear && !target) {
    const cleared = clearWorkspaceLogs(context);
    reportCleared(cleared);
    return;
  }

  if (services.length === 0) {
    warning(`No matching service found for ${target || 'workspace'}.`);
    return;
  }

  if (request.clear) {
    const cleared = clearServiceLog(context, services[0]);
    reportCleared(cleared);
    return;
  }

  if (target) {
    await followLogs(context, services[0]);
    return;
  }

  await followWorkspaceLogs(context, services);
}

function parseLogArgs(args = []) {
  const clear = args.some((arg) => CLEAR_ARGS.has(arg));
  const target = args.find((arg) => !CLEAR_ARGS.has(arg));

  return { clear, target };
}

function sectionTitle(clear, target) {
  if (clear) {
    return target ? `Clear Logs: ${target}` : 'Clear Workspace Logs';
  }

  return target ? `Logs: ${target}` : 'Workspace Logs';
}

function reportCleared(cleared) {
  if (cleared === 0) {
    info('No log files to clear.');
    return;
  }

  success(`Cleared ${cleared} log ${cleared === 1 ? 'file' : 'files'}.`);
}

module.exports = { showLogs };
