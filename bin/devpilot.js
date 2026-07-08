#!/usr/bin/env node
'use strict';

let cli;
let ui;
let logger;

try {
  cli = require('../dist/cli');
  ui = require('../dist/ui');
  logger = require('../dist/logger');
} catch (error) {
  console.error('DevPilot has not been built yet. Run "npm run build" from the package root.');
  process.exit(1);
}

const { main } = cli;
const { line } = ui;
const { error: logError } = logger;

main().catch((error) => {
  line();
  logError(error.message);
  process.exitCode = 1;
});
