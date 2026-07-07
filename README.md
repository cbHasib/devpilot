# DevPilot

DevPilot is a reusable project management CLI for multi-service development workspaces.

Install it once, configure it per project, and then run one memorable project command from anywhere on your machine.

```bash
my-services
my-services dev
my-services build
my-services doctor
```

DevPilot is useful when a project has multiple apps or services, for example:

```text
my-project/
  backend/
  frontend/
  storefront/
  landing/
```

Instead of remembering every folder and command, DevPilot stores the project setup once and gives you a clean terminal menu plus direct commands.

## Features

- Global CLI command: `devpilot`
- Per-project custom aliases, for example `my-services`
- Works from any terminal path after setup
- Auto-detects service folders with `package.json`
- Supports `npm`, `yarn`, `pnpm`, and `bun`
- Runs `dev`, `install`, `build`, `lint`, `clean`, `doctor`, and `update`
- Opens services in terminal tabs on supported systems
- Falls back to running services in the current terminal
- Keeps machine-specific project config out of git by default
- Checks for new versions in the background and shows an update notice

## Author

Created and maintained by **Hasibul Hasan**.

- GitHub: [cbHasib](https://github.com/cbHasib)
- npm: [cbHasib](https://www.npmjs.com/~cbhasib)
- Website: [hasib.me](https://hasib.me)

## Installation

Install DevPilot globally:

```bash
npm install -g @cbhasib/devpilot
```

Check that it is available:

```bash
devpilot --version
devpilot help
```

## Project Setup

Open the root folder of the project you want to manage:

```bash
cd /path/to/my-project
```

Run setup:

```bash
devpilot setup
```

DevPilot will ask for:

- project display name
- command alias, for example `my-services`
- package manager
- development launch mode
- service folders
- dev, build, and lint commands for each service

Example answers:

```text
Project display name: My Project
Command alias: my-services
Package manager: yarn
Development launch mode: tabs
```

After setup, DevPilot writes a local config file:

```text
.devpilot.json
```

It also adds these entries to the project `.gitignore`:

```gitignore
.devpilot.json
.devpilot/
```

These files are ignored because project paths, generated aliases, and local preferences can be different on every developer machine.

## Global Alias Behavior

When you create the alias `my-services`, DevPilot creates a global command that points back to the project path where setup was run.

That means this works from anywhere:

```bash
cd ~
my-services
my-services dev
my-services build
```

The alias loads the original project config, changes into the correct project or service folders internally, and runs the configured commands there.

If you move the project folder later, run setup again from the new location and recreate the alias.

## Usage

Open the interactive menu:

```bash
my-services
```

Run direct commands:

```bash
my-services dev
my-services install
my-services build
my-services lint
my-services clean
my-services doctor
my-services update
my-services about
```

You can also use the generic command from inside the project:

```bash
devpilot
devpilot dev
devpilot doctor
```

## Commands

### `dev`

Starts all configured services.

```bash
my-services dev
```

On macOS, DevPilot uses Terminal tabs when possible. On Linux, it uses GNOME Terminal tabs when available. Otherwise, it starts services in the current terminal.

### `install`

Installs dependencies in every configured service folder.

```bash
my-services install
```

The install command depends on the package manager:

```text
npm  -> npm install
yarn -> yarn install
pnpm -> pnpm install
bun  -> bun install
```

### `build`

Runs each service build command.

```bash
my-services build
```

### `lint`

Runs each service lint command.

```bash
my-services lint
```

### `clean`

Removes common generated folders from each service:

```text
node_modules
dist
.next
coverage
```

```bash
my-services clean
```

### `doctor`

Checks local tools and project setup.

```bash
my-services doctor
```

It reports Node.js, package manager, Git, project root, service count, and terminal-tab support.

### `update`

Runs `git pull` from the project root and then installs service dependencies.

```bash
my-services update
```

### `about`

Shows DevPilot package information.

```bash
my-services about
```

## Update Notifications

Every DevPilot command (including project aliases) checks for a newer published version at most once per day. The check runs in a detached background process, so it never slows commands down, and the result is cached in `~/.devpilot/update-check.json`. When a newer version exists, a notice with the install command is shown at the end of the run:

```text
╭────────────────────────────────────────────────────────────╮
│ ▲ Update available                         v0.1.3 → v0.2.0 │
│ Run npm install -g @cbhasib/devpilot@latest to update      │
╰────────────────────────────────────────────────────────────╯
```

To disable the check, set `DEVPILOT_NO_UPDATE_CHECK=1`. It is also skipped automatically in CI and non-interactive shells.

## Example Config

A generated `.devpilot.json` can look like this:

```json
{
  "schemaVersion": 1,
  "projectName": "My Project",
  "alias": "my-services",
  "packageManager": "yarn",
  "launchMode": "tabs",
  "services": [
    {
      "dir": "backend",
      "name": "Backend API",
      "dev": "yarn start:dev",
      "build": "yarn build",
      "lint": "yarn lint"
    },
    {
      "dir": "frontend",
      "name": "Frontend",
      "dev": "yarn dev",
      "build": "yarn build",
      "lint": "yarn lint"
    }
  ],
  "createdAt": "2026-07-07T00:00:00.000Z"
}
```

This file is intentionally local by default. If a team wants to share a preset, copy the values into documentation or create a committed template separately.