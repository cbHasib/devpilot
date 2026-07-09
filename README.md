# DevPilot

Run a local multi-service workspace from one command.

DevPilot is a small CLI for projects where local development means starting several folders every day: a web app, an API, a worker, docs, admin, or any other service with its own command.

> **Important:** DevPilot does not replace Docker Compose, Turborepo, Nx, pnpm workspaces, or your package manager. It sits above them as the daily developer entry point.

```bash
npm install -g @cbhasib/devpilot
devpilot setup
```

After setup, use your project alias:

```bash
my-app
my-app dev
```

## Why Use It?

Use DevPilot when a developer has to remember things like:

```bash
cd apps/web && pnpm dev
cd apps/api && pnpm start:dev
cd workers/email && pnpm dev
docker compose up -d postgres redis
```

DevPilot lets that workflow live in one config, then the project gets one command.

It is useful for:

- starting multiple local services
- opening services in terminal tabs where supported
- optionally keeping per-service logs when running in managed current-terminal mode
- checking or stopping DevPilot-managed services when DevPilot owns the process
- creating profiles like `frontend`, `backend`, or `fullstack`
- adding project hooks such as `docker compose up -d`

It is not meant for:

- production orchestration
- container networking
- build caching
- replacing `docker compose`, Turborepo, Nx, pnpm, npm, Yarn, or Bun

## What Stacks Work?

DevPilot works best with JavaScript and TypeScript workspaces where services live in folders with `package.json`.

It detects:

- package managers: npm, Yarn, pnpm, Bun
- workspace layouts: Turborepo, Nx, pnpm workspace, Lerna, package.json workspaces
- common folders: `apps/`, `packages/`, `services/`, `frontend/`, `backend/`, `api/`, `admin/`, `worker/`, `mobile/`, `landing/`
- frameworks: Next.js, React, Vite, Vue, Angular, Astro, Remix, VitePress, NestJS, Express, Fastify

You can still edit `.devpilot.json` and use custom commands. If a service can be started from a folder with a shell command, DevPilot can usually manage it.

## Example: Full-Stack App

```text
my-app/
  backend/
    package.json
  frontend/
    package.json
  worker/
    package.json
```

Run setup:

```bash
cd my-app
devpilot setup
```

DevPilot detects the services and writes:

```json
{
  "alias": "my-app",
  "packageManager": "pnpm",
  "launchMode": "tabs",
  "services": [
    {
      "dir": "backend",
      "name": "Backend",
      "dev": "pnpm dev",
      "build": "pnpm build",
      "lint": "pnpm lint",
      "framework": "NestJS",
      "port": 3000
    },
    {
      "dir": "frontend",
      "name": "Frontend",
      "dev": "pnpm dev",
      "build": "pnpm build",
      "lint": "pnpm lint",
      "framework": "Next.js",
      "port": 3000
    },
    {
      "dir": "worker",
      "name": "Worker",
      "dev": "pnpm dev",
      "build": "pnpm build",
      "lint": "pnpm lint"
    }
  ]
}
```

Then:

```bash
my-app dev
```

## Example: Monorepo

```text
product/
  apps/
    web/
    api/
    admin/
  packages/
    ui/
  turbo.json
  pnpm-workspace.yaml
```

DevPilot can detect the workspace and service folders, then run the local commands from each service directory.

```bash
product dev
product build
product lint
product doctor
```

If the repo already uses Turborepo or Nx, keep using them. DevPilot can run your existing commands; it is just the project-level launcher.

## Example: App Services Plus Docker Infra

Use Docker Compose for infrastructure. Use DevPilot for the developer workflow.

```json
{
  "hooks": {
    "beforeDev": ["docker compose up -d postgres redis"]
  },
  "services": [
    {
      "dir": "apps/api",
      "name": "API",
      "dev": "pnpm dev",
      "build": "pnpm build",
      "lint": "pnpm lint"
    },
    {
      "dir": "apps/web",
      "name": "Web",
      "dev": "pnpm dev",
      "build": "pnpm build",
      "lint": "pnpm lint"
    }
  ]
}
```

Now one command starts the infra hook and the app services:

```bash
my-app dev
```

This is the difference:

- Docker Compose runs containers.
- DevPilot runs the local developer workflow around your project.

## Profiles

Profiles let people start only the part of the workspace they need.

```json
{
  "profiles": {
    "frontend": ["apps/web", "apps/admin"],
    "backend": ["apps/api", "workers/email"],
    "fullstack": ["*"]
  }
}
```

Use them like this:

```bash
my-app dev frontend
my-app status backend
my-app logs api
my-app logs --profile frontend
```

Profile ids are lowercase slugs, so `Frontend`, `front-end`, and `frontend` resolve to the same profile id. Commands that target services, such as `logs`, `stop`, and `restart`, treat an ambiguous name as a service; use `--profile <id>` when you mean the profile.

When multiple profiles exist, the interactive menu asks which profile to use.

## Service Dependencies

Services can start in dependency order.

```json
{
  "services": [
    {
      "dir": "apps/api",
      "name": "API",
      "dev": "pnpm dev"
    },
    {
      "dir": "apps/web",
      "name": "Web",
      "dev": "pnpm dev",
      "dependsOn": ["API"],
      "delay": 2000
    }
  ]
}
```

`dependsOn` starts API first. `delay` waits before Web starts.

## Logs And Process Management

With the default `tabs` launch mode, DevPilot opens each service folder in its own terminal and runs the configured `dev` command directly. Those tab-launched services are controlled by their terminal tabs, so use Ctrl+C in the tab to stop them.

Runtime state is only available when DevPilot owns the process, such as `launchMode: "current"` or services started through `restart`. That state stays inside the project:

```text
.devpilot/runtime/
  logs/
  registry.json
```

Commands:

```bash
my-app status
my-app logs
my-app logs api
my-app logs clear
my-app restart api
my-app stop
```

Managed `dev` runs clear saved logs for the services they are about to start, so log output starts fresh for the current run.

DevPilot does not scan your machine for random processes and kill them. It only stops services recorded in its own runtime registry.

## Commands

| Command | What it does |
| --- | --- |
| `dev` | Start configured services |
| `install` | Install dependencies in each service |
| `build` | Run build commands |
| `lint` | Run lint commands |
| `status` | Show DevPilot-managed service state |
| `logs` | Follow or clear service logs |
| `stop` | Stop DevPilot-managed services |
| `restart` | Restart services |
| `clean` | Remove generated folders and clear logs |
| `doctor` | Check local tools and config |
| `update` | Pull project changes and reinstall dependencies |
| `upgrade` | Update DevPilot itself |
| `profiles` | List workspace profiles |
| `profile` | Create, edit, or delete profiles |
| `about` | Show package and project info |

## Install

```bash
npm install -g @cbhasib/devpilot
```

Other package managers:

```bash
yarn global add @cbhasib/devpilot
pnpm add -g @cbhasib/devpilot
bun add -g @cbhasib/devpilot
```

Verify:

```bash
devpilot --version
devpilot help
```

## Setup

Run setup from your project root:

```bash
devpilot setup
```

Setup creates:

```text
.devpilot.json
```

It also updates `.gitignore` with:

```gitignore
.devpilot.json
.devpilot/
```

By default, setup keeps `.devpilot.json` local because alias, editor, and launch mode can be personal. If your team wants one shared workflow, remove `.devpilot.json` from `.gitignore`, commit a reviewed config, and keep `.devpilot/` ignored for runtime state.

## Updating DevPilot

DevPilot checks for new versions in the background. When an update is available, the interactive menu shows an update notice and supports pressing `U` to upgrade.

Manual update:

```bash
devpilot upgrade
```

Non-interactive:

```bash
devpilot upgrade --yes
```

Disable update checks:

```bash
export DEVPILOT_NO_UPDATE_CHECK=1
```

## Development

DevPilot is written in TypeScript and compiled to CommonJS for npm.

```bash
npm install
npm run typecheck
npm run build
npm run check
npm run pack:dry
```

Project map:

```text
src/
  cli.ts
  commands/
  profiles/
  runtime/
  workspace/
  menu.ts
  setup.ts
  update-check.ts
  types.ts
```

See `CONTRIBUTING.md` for contributor notes and release checks.

## Author

Hasibul Hasan

- GitHub: https://github.com/cbHasib
- npm: https://www.npmjs.com/~cbhasib
- Website: https://hasib.me

## License

MIT
