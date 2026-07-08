'use strict';

const { titleCase } = require('../utils');

const FRONTEND_FRAMEWORKS = new Set(['next.js', 'react', 'angular', 'vue', 'vite', 'astro', 'remix', 'vitepress']);
const BACKEND_FRAMEWORKS = new Set(['nestjs', 'express', 'fastify']);
const BACKEND_NAME_PATTERN = /\b(api|backend|server|service|worker|queue|jobs?)\b/i;
const FRONTEND_NAME_PATTERN = /\b(frontend|web|app|client|admin|dashboard|docs?|site|mobile)\b/i;

function normalizeProfiles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.keys(value).reduce((profiles, name) => {
    const id = String(name || '').trim();

    if (!id) {
      return profiles;
    }

    const definition = value[name];

    if (Array.isArray(definition)) {
      profiles[id] = cleanServiceList(definition);
      return profiles;
    }

    if (!definition || typeof definition !== 'object') {
      profiles[id] = [];
      return profiles;
    }

    const next = { ...definition };
    next.services = cleanServiceList(definition.services);
    next.env = normalizeEnv(definition.env);

    if (Object.keys(next.env).length === 0) {
      delete next.env;
    }

    profiles[id] = next;
    return profiles;
  }, {});
}

function normalizeHooks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.keys(value).reduce((hooks, name) => {
    const commands = cleanHookList(value[name]);

    if (commands.length > 0) {
      hooks[name] = commands;
    }

    return hooks;
  }, {});
}

function listProfiles(config) {
  const profiles = normalizeProfiles(config && config.profiles);

  return Object.keys(profiles).map((id) => profileFromDefinition(id, profiles[id]));
}

function hasProfiles(config) {
  return listProfiles(config).length > 0;
}

function findProfile(config, target) {
  const normalized = tokenKey(target);

  if (!normalized) {
    return null;
  }

  return listProfiles(config).find((profile) => (
    tokenKey(profile.id) === normalized || tokenKey(profile.name) === normalized
  )) || null;
}

function applyProfileArg(context, args = [], options: { strict?: boolean } = {}) {
  const target = args[0];

  if (!target) {
    return { context, args, profile: null, consumed: false, warnings: [], ok: true };
  }

  const profile = findProfile(context.config, target);

  if (!profile) {
    if (options.strict) {
      const message = hasProfiles(context.config)
        ? `Unknown profile: ${target}.`
        : 'No profiles are configured for this workspace.';

      return {
        context,
        args,
        profile: null,
        consumed: false,
        warnings: [message],
        ok: false
      };
    }

    return { context, args, profile: null, consumed: false, warnings: [], ok: true };
  }

  const resolved = contextForProfile(context, profile);

  return {
    context: resolved.context,
    args: args.slice(1),
    profile,
    consumed: true,
    warnings: resolved.warnings,
    ok: true
  };
}

/**
 * Returns a shallow cloned command context whose services are filtered to the
 * active profile. The original service list is preserved as `allServices` so
 * dependency resolution and validation can still see the full workspace.
 */
function contextForProfile(context, profile) {
  const allServices = context.allServices || context.config.services || [];
  const resolved = servicesForProfile(allServices, profile);
  const activeProfile = {
    id: profile.id,
    name: profile.name,
    env: profile.env
  };

  return {
    context: {
      ...context,
      allServices,
      activeProfile,
      profileEnv: profile.env,
      config: {
        ...context.config,
        services: resolved.services,
        activeProfile
      }
    },
    warnings: resolved.warnings
  };
}

/**
 * Adds only profile environment metadata to a context. This is used by hidden
 * terminal-tab service runners, where the service target is already known.
 */
function contextWithProfileEnv(context, profile) {
  if (!profile) {
    return context;
  }

  const activeProfile = {
    id: profile.id,
    name: profile.name,
    env: profile.env
  };

  return {
    ...context,
    activeProfile,
    profileEnv: profile.env,
    config: {
      ...context.config,
      activeProfile
    }
  };
}

function profileEnv(context) {
  const source = context.profileEnv
    || (context.activeProfile && context.activeProfile.env)
    || (context.config && context.config.activeProfile && context.config.activeProfile.env)
    || {};

  return normalizeEnv(source);
}

function servicesForProfile(services, profile) {
  const tokens = profile.services || [];

  if (tokens.includes('*')) {
    return { services: [...services], warnings: [] };
  }

  const selected = [];
  const missing = [];

  tokens.forEach((token) => {
    const match = findService(services, token);

    if (!match) {
      missing.push(token);
      return;
    }

    if (!selected.some((service) => sameService(service, match))) {
      selected.push(match);
    }
  });

  const warnings = missing.map((token) => (
    `Profile "${profile.name}" references missing service "${token}".`
  ));

  return { services: selected, warnings };
}

function profileFromDefinition(id, definition) {
  const source = definition && typeof definition === 'object' && !Array.isArray(definition)
    ? definition
    : {};

  return {
    id,
    name: String(source.name || titleCase(id)).trim(),
    services: Array.isArray(definition) ? cleanServiceList(definition) : cleanServiceList(source.services),
    env: normalizeEnv(source.env),
    raw: definition
  };
}

function recommendedProfiles(services) {
  const frontend = [];
  const backend = [];

  (services || []).forEach((service) => {
    if (isFrontendService(service)) {
      frontend.push(service.dir);
    }

    if (isBackendService(service)) {
      backend.push(service.dir);
    }
  });

  const profiles: Record<string, string[]> = {};

  if (frontend.length > 0) {
    profiles.frontend = frontend;
  }

  if (backend.length > 0) {
    profiles.backend = backend;
  }

  if ((services || []).length > 1) {
    profiles.fullstack = ['*'];
  }

  return profiles;
}

function serializeProfile(services, env = {}) {
  const cleanServices = cleanServiceList(services);
  const cleanEnv = normalizeEnv(env);

  if (Object.keys(cleanEnv).length === 0) {
    return cleanServices;
  }

  return {
    services: cleanServices,
    env: cleanEnv
  };
}

function profileServiceTokens(profile) {
  return [...(profile.services || [])];
}

function cleanServiceList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function cleanHookList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeEnv(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.keys(value).reduce((env, name) => {
    const key = String(name || '').trim();

    if (!key) {
      return env;
    }

    env[key] = String(value[name]);
    return env;
  }, {});
}

function parseEnvInput(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((env, entry) => {
      const index = entry.indexOf('=');

      if (index <= 0) {
        return env;
      }

      const key = entry.slice(0, index).trim();
      const envValue = entry.slice(index + 1).trim();

      if (key) {
        env[key] = envValue;
      }

      return env;
    }, {});
}

function envToInput(env) {
  return Object.keys(normalizeEnv(env))
    .map((key) => `${key}=${env[key]}`)
    .join(', ');
}

function findService(services, token) {
  const normalized = tokenKey(token);

  if (!normalized) {
    return null;
  }

  return (services || []).find((service) => serviceMatches(service, normalized)) || null;
}

function serviceMatches(service, normalizedToken) {
  return [
    service.name,
    service.dir,
    String(service.dir || '').split(/[\\/]/).pop()
  ].some((value) => tokenKey(value) === normalizedToken);
}

function sameService(a, b) {
  return tokenKey(a && a.dir) === tokenKey(b && b.dir);
}

function tokenKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isFrontendService(service) {
  const framework = String(service.framework || '').toLowerCase();
  const label = `${service.name || ''} ${service.dir || ''}`;
  return FRONTEND_FRAMEWORKS.has(framework) || FRONTEND_NAME_PATTERN.test(label);
}

function isBackendService(service) {
  const framework = String(service.framework || '').toLowerCase();
  const label = `${service.name || ''} ${service.dir || ''}`;
  return BACKEND_FRAMEWORKS.has(framework) || BACKEND_NAME_PATTERN.test(label);
}

module.exports = {
  applyProfileArg,
  contextForProfile,
  contextWithProfileEnv,
  envToInput,
  findProfile,
  findService,
  hasProfiles,
  listProfiles,
  normalizeEnv,
  normalizeHooks,
  normalizeProfiles,
  parseEnvInput,
  profileEnv,
  profileServiceTokens,
  recommendedProfiles,
  serializeProfile,
  servicesForProfile,
  tokenKey
};
