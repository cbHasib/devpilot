'use strict';

const clack = require('@clack/prompts');

function answer(promptPromise) {
  return promptPromise.then((value) => {
    if (clack.isCancel(value)) {
      clack.cancel('Setup cancelled.');
      process.exit(130);
    }

    return value;
  });
}

function requiredField(value) {
  if (!String(value || '').trim()) {
    return 'This field is required.';
  }
}

module.exports = { answer, requiredField };
