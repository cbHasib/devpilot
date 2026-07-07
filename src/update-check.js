'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const pkg = require('../package.json');
const { line, rule, bannerRow, paint, style } = require('./ui');

const CACHE_FILE = path.join(os.homedir(), '.devpilot', 'update-check.json');
const CHECK_INTERVAL_MS =10 * 60 * 1000; // 10 minutes
const FETCH_TIMEOUT_MS = 5000; // 5 seconds

function scheduleUpdateCheck() {
  if (!process.stdout.isTTY || process.env.CI || process.env.DEVPILOT_NO_UPDATE_CHECK) {
    return;
  }

  const cache = readCache();

  if (cache.latest && isNewer(cache.latest, pkg.version)) {
    process.on('exit', () => printUpdateNotice(cache.latest));
  }

  if (!cache.lastChecked || Date.now() - cache.lastChecked > CHECK_INTERVAL_MS) {
    spawn(process.execPath, [__filename, '--refresh'], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
}

function printUpdateNotice(latest) {
  const installCommand = `npm install -g ${pkg.name}@latest`;

  line();
  line(rule('┏', '┓'));
  line(bannerRow(
    `${style('▲', 'yellow')} ${style('Update available', 'yellow', 'bold')}`,
    `${paint(`v${pkg.version}`, 'dim')} ${paint('→', 'gray')} ${style(`v${latest}`, 'green', 'bold')}`
  ));
  line(bannerRow(`${paint('Run', 'dim')} ${style(installCommand, 'cyan', 'bold')} ${paint('to update', 'dim')}`));
  line(rule('┗', '┛'));
  line();
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

async function refreshCache() {
  const cache = readCache();
  const next = { lastChecked: Date.now(), latest: cache.latest || null };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const registryUrl = `https://registry.npmjs.org/${pkg.name.replace('/', '%2F')}/latest`;
    const response = await fetch(registryUrl, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });
    clearTimeout(timer);

    if (response.ok) {
      const body = await response.json();

      if (body && typeof body.version === 'string') {
        next.latest = body.version;
      }
    }
  } catch (error) {
    // Offline or registry unreachable — keep the previous value and retry after the interval.
  }

  writeCache(next);
}

if (require.main === module && process.argv[2] === '--refresh') {
  refreshCache();
}

module.exports = { scheduleUpdateCheck };
