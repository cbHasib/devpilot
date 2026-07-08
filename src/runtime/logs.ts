'use strict';

const fs = require('fs');

const { line, paint } = require('../ui');
const { entryForService, logPath } = require('./registry');

function appendLog(stream, chunk) {
  if (!stream || !chunk) {
    return;
  }

  stream.write(chunk);
}

async function followLogs(context, service) {
  const entry = service ? entryForService(context.root, service) : null;
  const file = entry && entry.logPath ? entry.logPath : service ? logPath(context.root, service) : null;

  if (!file || !fs.existsSync(file)) {
    line(`  ${paint('No logs available for this service yet.', 'dim')}`);
    return;
  }

  await followFile(file);
}

async function followWorkspaceLogs(context, services) {
  const targets = services
    .map((service) => {
      const entry = entryForService(context.root, service);
      const file = entry && entry.logPath ? entry.logPath : logPath(context.root, service);
      return fs.existsSync(file) ? { service, file } : null;
    })
    .filter(Boolean);

  if (targets.length === 0) {
    line(`  ${paint('No logs available yet.', 'dim')}`);
    return;
  }

  await Promise.all(targets.map((target) => followFile(target.file, target.service.name)));
}

function followFile(file, label = '') {
  return new Promise<void>((resolve) => {
    let position = printTail(file, label);
    const timer = setInterval(() => {
      position = printNewContent(file, position, label);
    }, 500);
    const stop = () => {
      clearInterval(timer);
      process.removeListener('SIGINT', stop);
      resolve();
    };

    process.once('SIGINT', stop);
  });
}

function printTail(file, label) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/).slice(-80).join('\n');

  if (lines.trim()) {
    printContent(lines, label);
  }

  return Buffer.byteLength(content);
}

function printNewContent(file, position, label) {
  const stat = fs.statSync(file);

  if (stat.size <= position) {
    return position;
  }

  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(stat.size - position);
  fs.readSync(fd, buffer, 0, buffer.length, position);
  fs.closeSync(fd);
  printContent(buffer.toString('utf8'), label);
  return stat.size;
}

function printContent(content, label) {
  const prefix = label ? `${paint(`[${label}]`, 'cyan')} ` : '';
  content.split(/\r?\n/).forEach((lineValue) => {
    if (lineValue) {
      line(`${prefix}${lineValue}`);
    }
  });
}

module.exports = {
  appendLog,
  followLogs,
  followWorkspaceLogs
};
