'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const pkg = require('../package.json');
const { line, rule, bannerRow, paint, style } = require('./ui');

const CACHE_FILE = path.join(os.homedir(), '.devpilot', 'update-check.json');
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 5000; // 5 seconds

function scheduleUpdateCheck(options = {}) {
  const notifyOnExit = options.notifyOnExit !== false;

  if (!process.stdout.isTTY || process.env.CI || process.env.DEVPILOT_NO_UPDATE_CHECK) {
    return;
  }

  const update = cachedUpdate();

  if (notifyOnExit && update) {
    process.on('exit', () => printUpdateNotice(update));
  }

  const cache = readCache();

  if (!cache.lastChecked || Date.now() - cache.lastChecked > CHECK_INTERVAL_MS) {
    spawn(process.execPath, [__filename, '--refresh'], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
}

function cachedUpdate() {
  const cache = readCache();
  return updateFromLatest(cache.latest);
}

function updateFromLatest(latest) {
  if (!latest || !isNewer(latest, pkg.version)) {
    return null;
  }

  return {
    packageName: pkg.name,
    current: pkg.version,
    latest,
    command: 'devpilot upgrade',
    installCommand: installCommand()
  };
}

function installCommand() {
  return `npm install -g ${pkg.name}@latest`;
}

function printUpdateNotice(update) {
  const notice = normalizeUpdate(update);

  if (!notice) {
    return;
  }

  line();
  line(rule('┏', '┓'));
  line(bannerRow(
    `${style('▲', 'yellow')} ${style('Update available', 'yellow', 'bold')}`,
    `${paint(`v${notice.current}`, 'dim')} ${paint('→', 'gray')} ${style(`v${notice.latest}`, 'green', 'bold')}`
  ));
  line(bannerRow(`${paint('Run', 'dim')} ${style(notice.command, 'cyan', 'bold')} ${paint('to update DevPilot', 'dim')}`));
  line(rule('┗', '┛'));
  line();
}

function printMenuUpdateBanner(update) {
  const notice = normalizeUpdate(update);

  if (!notice) {
    return;
  }

  line();
  line(rule('┏', '┓'));
  line(bannerRow(
    `${style('▲', 'yellow')} ${style('DevPilot update available', 'yellow', 'bold')}`,
    `${paint(`v${notice.current}`, 'dim')} ${paint('→', 'gray')} ${style(`v${notice.latest}`, 'green', 'bold')}`
  ));
  line(bannerRow(`${paint('Press', 'dim')} ${style('U', 'cyan', 'bold')} ${paint('to update or run', 'dim')} ${style(notice.command, 'cyan', 'bold')}`));
  line(rule('┗', '┛'));
}

function normalizeUpdate(update) {
  if (typeof update === 'string') {
    return updateFromLatest(update);
  }

  if (!update || !update.latest) {
    return null;
  }

  return {
    packageName: update.packageName || pkg.name,
    current: update.current || pkg.version,
    latest: update.latest,
    command: update.command || 'devpilot upgrade',
    installCommand: update.installCommand || installCommand()
  };
}

function isNewer(latest, current) {
  const parse = (value) => String(value).split('.').map((part) => parseInt(part, 10) || 0);
  const a = parse(latest);
  const b = parse(current);

  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) {
      return true;
    }

    if ((a[index] || 0) < (b[index] || 0)) {
      return false;
    }
  }

  return false;
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
}

async function refreshCache(options = {}) {
  const cache = readCache();
  const next = { lastChecked: Date.now(), latest: cache.latest || null };
  const timeoutMs = options.timeoutMs || FETCH_TIMEOUT_MS;
  let checked = false;
  let timer = null;

  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    const registryUrl = `https://registry.npmjs.org/${pkg.name.replace('/', '%2F')}/latest`;
    const response = await fetch(registryUrl, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });

    if (response.ok) {
      checked = true;
      const body = await response.json();

      if (body && typeof body.version === 'string') {
        next.latest = body.version;
      }
    }
  } catch (error) {
    // Offline or registry unreachable — keep the previous value and retry after the interval.
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }

  writeCache(next);
  return { ...next, checked };
}

if (require.main === module && process.argv[2] === '--refresh') {
  refreshCache();
}

module.exports = {
  scheduleUpdateCheck,
  cachedUpdate,
  updateFromLatest,
  installCommand,
  printUpdateNotice,
  printMenuUpdateBanner,
  isNewer,
  refreshCache
};
