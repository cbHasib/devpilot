'use strict';

function workspaceLabel(workspace) {
  if (!workspace) {
    return 'Unknown';
  }

  return workspace.type || workspace.name || 'Unknown';
}

function serviceFrameworks(services) {
  const frameworks = new Set();

  (services || []).forEach((service) => {
    if (service.framework) {
      frameworks.add(service.framework);
    }
  });

  return [...frameworks];
}

function createTimer() {
  const started = process.hrtime.bigint();

  return {
    seconds() {
      const elapsed = Number(process.hrtime.bigint() - started) / 1e9;
      return elapsed;
    },
    label() {
      return formatSeconds(this.seconds());
    }
  };
}

function formatSeconds(seconds) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`;
  }

  return `${seconds.toFixed(2)} seconds`;
}

module.exports = {
  workspaceLabel,
  serviceFrameworks,
  createTimer,
  formatSeconds
};
