#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');
const { line } = require('../src/ui');
const { error: logError } = require('../src/logger');

main().catch((error) => {
  line();
  logError(error.message);
  process.exitCode = 1;
});
