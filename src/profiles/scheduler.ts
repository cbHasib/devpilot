'use strict';

const { normalizeDelay, startupBatches } = require('./dependencies');

function createLaunchPlan(context, services) {
  return startupBatches(context, services);
}

/**
 * Launches dependency batches in order. Delays are applied per service inside
 * each batch so unrelated services can still start in parallel.
 */
async function runLaunchPlan(plan, launchService) {
  let index = 0;

  for (const batch of plan.batches) {
    await Promise.all(batch.map(async (service) => {
      const delay = normalizeDelay(service.delay);

      if (delay > 0) {
        await wait(delay);
      }

      launchService(service, index);
      index += 1;
    }));
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  createLaunchPlan,
  runLaunchPlan,
  wait
};
