'use strict';

const fs = require('fs');
const { spawn } = require('child_process');

const { servicePath, shellQuote } = require('../utils');
const { profileEnv } = require('../profiles/manager');
const { appendLog } = require('./logs');
const {
  ensureRuntime,
  entryForService,
  logPath,
  processAlive,
  serviceKey,
  updateEntry,
  upsertEntry
} = require('./registry');

const STOP_TIMEOUT_MS = 4000;

/**
 * Starts a service and records enough runtime metadata for status, logs, stop,
 * and restart commands to work without scanning or killing unrelated processes.
 */
function startService(context, service, options: { detached?: boolean; mirror?: boolean; terminalSession?: string | null } = {}) {
  ensureRuntime(context.root);

  const cwd = servicePath(context, service);
  const logFile = logPath(context.root, service);

  if (options.detached) {
    return startDetachedService(context, service, cwd, logFile);
  }

  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const child = spawn(spawnCommand(service.dev), {
    cwd,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
    env: serviceEnv(context)
  });
  const key = serviceKey(service);
  const startedAt = new Date().toISOString();

  logStream.write(`\n[DevPilot] ${startedAt} ${service.name}: ${service.dev}\n`);
  upsertEntry(context.root, {
    key,
    serviceName: service.name,
    serviceDir: service.dir,
    pid: child.pid,
    startedAt,
    stoppedAt: null,
    cwd,
    command: service.dev,
    status: 'running',
    exitCode: null,
    platform: process.platform,
    launchMode: context.config.launchMode,
    logPath: logFile,
    port: service.port || null,
    framework: service.framework || '',
    terminalSession: options.terminalSession || null
  });

  child.stdout.on('data', (chunk) => {
    appendLog(logStream, chunk);

    if (options.mirror !== false) {
      process.stdout.write(chunk);
    }
  });

  child.stderr.on('data', (chunk) => {
    appendLog(logStream, chunk);

    if (options.mirror !== false) {
      process.stderr.write(chunk);
    }
  });

  const done = new Promise((resolve) => {
    child.on('error', (error) => {
      logStream.write(`[DevPilot] failed: ${error.message}\n`);
      finish(context, key, logStream, 1, 'failed');
      resolve(1);
    });

    child.on('close', (code) => {
      const exitCode = code || 0;
      finish(context, key, logStream, exitCode, exitCode === 0 ? 'exited' : 'failed');
      resolve(exitCode);
    });
  });

  return { child, done, key };
}

function startDetachedService(context, service, cwd, logFile) {
  const key = serviceKey(service);
  const startedAt = new Date().toISOString();
  const fd = fs.openSync(logFile, 'a');

  fs.writeSync(fd, `\n[DevPilot] ${startedAt} ${service.name}: ${service.dev}\n`);

  const child = spawn(spawnCommand(service.dev), {
    cwd,
    shell: true,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: serviceEnv(context)
  });

  upsertEntry(context.root, {
    key,
    serviceName: service.name,
    serviceDir: service.dir,
    pid: child.pid,
    startedAt,
    stoppedAt: null,
    cwd,
    command: service.dev,
    status: 'running',
    exitCode: null,
    platform: process.platform,
    launchMode: context.config.launchMode,
    logPath: logFile,
    port: service.port || null,
    framework: service.framework || '',
    terminalSession: null
  });

  child.unref();
  fs.closeSync(fd);
  return { child, done: Promise.resolve(0), key };
}

async function stopService(context, service) {
  const entry = entryForService(context.root, service);

  if (!entry || !entry.pid || !processAlive(entry.pid)) {
    if (entry) {
      updateEntry(context.root, entry.key, {
        status: entry.status || 'stopped',
        stoppedAt: entry.stoppedAt || new Date().toISOString()
      });
    }

    return { stopped: false, reason: 'not-running' };
  }

  const terminated = await terminatePid(entry.pid);

  if (!terminated) {
    return { stopped: false, reason: 'signal-failed' };
  }

  updateEntry(context.root, entry.key, {
    status: 'stopped',
    exitCode: null,
    stoppedAt: new Date().toISOString()
  });
  return { stopped: true };
}

async function restartService(context, service) {
  await stopService(context, service);
  return startService(context, service, { detached: true, mirror: false });
}

function finish(context, key, logStream, exitCode, status) {
  updateEntry(context.root, key, {
    status,
    exitCode,
    stoppedAt: new Date().toISOString()
  });
  logStream.end(`[DevPilot] exited with code ${exitCode}\n`);
}

async function terminatePid(pid) {
  try {
    process.kill(killTarget(pid), 'SIGTERM');
  } catch (error) {
    return false;
  }

  const stopped = await waitForExit(pid, STOP_TIMEOUT_MS);

  if (stopped) {
    return true;
  }

  try {
    process.kill(killTarget(pid), 'SIGKILL');
  } catch (error) {
    // Already stopped or unsupported signal on this platform.
    return false;
  }

  return waitForExit(pid, STOP_TIMEOUT_MS);
}

function killTarget(pid) {
  // POSIX services are spawned detached, so the negative pid targets the whole
  // process group. Windows does not support that form and receives the pid.
  return process.platform === 'win32' ? pid : -pid;
}

function waitForExit(pid, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!processAlive(pid)) {
        clearInterval(timer);
        resolve(true);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

function spawnCommand(command) {
  if (process.platform === 'win32') {
    return command;
  }

  return `exec sh -c ${shellQuote(command)}`;
}

function serviceEnv(context) {
  return { ...process.env, ...profileEnv(context) };
}

module.exports = {
  restartService,
  startService,
  stopService
};
