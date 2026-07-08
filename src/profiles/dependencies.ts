'use strict';

const { findService, tokenKey } = require('./manager');

function normalizeDependsOn(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeDelay(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/**
 * Expands the selected services with their dependencies and returns launch
 * batches. Services in the same batch can start in parallel; later batches wait
 * for earlier dependencies to be launched first.
 */
function startupBatches(context, selectedServices) {
  const allServices = context.allServices || context.config.services || [];
  const warnings = [];
  const services = expandDependencies(selectedServices, allServices, warnings);
  const order = topologicalBatches(services, allServices);

  if (order.cycle) {
    warnings.push(`Circular service dependency detected: ${order.cycle.join(' -> ')}.`);
    return {
      services,
      batches: [services],
      warnings
    };
  }

  return {
    services,
    batches: order.batches,
    warnings
  };
}

function expandDependencies(selectedServices, allServices, warnings = []) {
  const selected = [];
  const seen = new Set();

  function add(service, trail = []) {
    if (!service) {
      return;
    }

    const key = serviceKey(service);

    if (!key || seen.has(key)) {
      return;
    }

    if (trail.includes(key)) {
      warnings.push(`Circular service dependency detected: ${trail.concat(key).join(' -> ')}.`);
      return;
    }

    normalizeDependsOn(service.dependsOn).forEach((dependencyName) => {
      const dependency = findService(allServices, dependencyName);

      if (!dependency) {
        warnings.push(`${service.name || service.dir} depends on missing service "${dependencyName}".`);
        return;
      }

      add(dependency, trail.concat(key));
    });

    seen.add(key);
    selected.push(service);
  }

  (selectedServices || []).forEach((service) => add(service));
  return selected;
}

function topologicalBatches(services, allServices) {
  const serviceMap = new Map<string, any>(services.map((service) => [serviceKey(service), service]));
  const remaining = new Set(serviceMap.keys());
  const batches = [];

  while (remaining.size > 0) {
    const ready = [];

    services.forEach((service) => {
      const key = serviceKey(service);

      if (!remaining.has(key)) {
        return;
      }

      const dependencies = dependencyKeys(service, allServices).filter((dependency) => serviceMap.has(dependency));
      const blocked = dependencies.some((dependency) => remaining.has(dependency));

      if (!blocked) {
        ready.push(service);
      }
    });

    if (ready.length === 0) {
      return {
        batches,
        cycle: [...remaining].map((key) => serviceMap.get(key).name || serviceMap.get(key).dir)
      };
    }

    batches.push(ready);
    ready.forEach((service) => remaining.delete(serviceKey(service)));
  }

  return { batches, cycle: null };
}

function dependencyKeys(service, allServices) {
  return normalizeDependsOn(service.dependsOn)
    .map((name) => findService(allServices, name))
    .filter(Boolean)
    .map(serviceKey);
}

function serviceKey(service) {
  return tokenKey(service && service.dir) || tokenKey(service && service.name);
}

module.exports = {
  normalizeDelay,
  normalizeDependsOn,
  startupBatches
};
