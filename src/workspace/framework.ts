'use strict';

const FRAMEWORKS = [
  { name: 'Next.js', deps: ['next'], files: ['next.config.js', 'next.config.mjs', 'next.config.ts'] },
  { name: 'NestJS', deps: ['@nestjs/core'], files: ['nest-cli.json'] },
  { name: 'Fastify', deps: ['fastify'] },
  { name: 'Express', deps: ['express'] },
  { name: 'Astro', deps: ['astro'], files: ['astro.config.js', 'astro.config.mjs', 'astro.config.ts'] },
  { name: 'Remix', deps: ['@remix-run/node', '@remix-run/react', '@remix-run/dev'], files: ['remix.config.js'] },
  { name: 'VitePress', deps: ['vitepress'] },
  { name: 'Angular', deps: ['@angular/core', '@angular/cli'], files: ['angular.json'] },
  { name: 'Vue', deps: ['vue'], files: ['vue.config.js'] },
  { name: 'React', deps: ['react'] },
  { name: 'Vite', deps: ['vite'], files: ['vite.config.js', 'vite.config.mjs', 'vite.config.ts'] }
];

const DEFAULT_PORTS = {
  'Next.js': 3000,
  NestJS: 3000,
  Express: 3000,
  Fastify: 3000,
  Remix: 3000,
  React: 5173,
  Vue: 5173,
  Vite: 5173,
  VitePress: 5173,
  Angular: 4200,
  Astro: 4321
};

function detectFramework(packageJson, files = []) {
  const dependencies = dependencyNames(packageJson);
  const fileSet = new Set(files);

  const match = FRAMEWORKS.find((framework) => (
    hasDependency(dependencies, framework.deps) || hasFile(fileSet, framework.files)
  ));

  return match ? match.name : '';
}

function defaultPort(framework) {
  return DEFAULT_PORTS[framework] || null;
}

function dependencyNames(packageJson) {
  const source = packageJson || {};
  return new Set([
    ...Object.keys(source.dependencies || {}),
    ...Object.keys(source.devDependencies || {}),
    ...Object.keys(source.peerDependencies || {})
  ]);
}

function hasDependency(dependencies, names = []) {
  return names.some((name) => dependencies.has(name));
}

function hasFile(files, names = []) {
  return names.some((name) => files.has(name));
}

module.exports = { detectFramework, defaultPort };
