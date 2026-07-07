#!/usr/bin/env node
'use strict';

const { main } = require('../src/cli');
const { line, fail } = require('../src/ui');

main().catch((error) => {
  line();
  fail(error.message);
  process.exitCode = 1;
});
