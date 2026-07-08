'use strict';

const { entries, entryForService, processAlive, updateEntry } = require('./registry');

function workspaceStatus(context) {
  const services = context.config.services || [];
  const records = entries(context.root);

  return services.map((service) => serviceStatus(context, service, records));
}

function serviceStatus(context, service, records = null) {
  const entry = records
    ? records.find((record) => record.serviceDir === service.dir)
    : entryForService(context.root, service);

  if (!entry) {
    return { service, entry: null, status: 'unknown', uptime: null };
  }

  if (entry.pid && entry.status === 'running' && !processAlive(entry.pid)) {
    const nextStatus = entry.exitCode && entry.exitCode !== 0 ? 'failed' : 'exited';
    const updated = updateEntry(context.root, entry.key, {
      status: nextStatus,
      stoppedAt: new Date().toISOString()
    });
    return statusFromEntry(service, updated || entry);
  }

  return statusFromEntry(service, entry);
}

function statusFromEntry(service, entry) {
  return {
    service,
    entry,
    status: entry.status || 'unknown',
    uptime: entry.status === 'running' ? uptime(entry.startedAt) : null
  };
}

function statusMark(status) {
  if (status === 'running') {
    return '✓';
  }

  if (status === 'failed' || status === 'stopped' || status === 'exited') {
    return '✗';
  }

  return '?';
}

function statusLabel(status) {
  if (!status) {
    return 'Unknown';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function uptime(startedAt) {
  const started = Date.parse(startedAt || '');

  if (!started) {
    return null;
  }

  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

module.exports = {
  serviceStatus,
  statusLabel,
  statusMark,
  uptime,
  workspaceStatus
};
