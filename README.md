# 🚀 DevPilot

> **Stop opening five terminals every morning. One command to run your entire development workspace.**

DevPilot is a **developer workspace manager** for multi-service projects.

Configure your project once, then launch, build, maintain, and manage your entire development workspace using a single memorable command—from anywhere on your machine.

```bash
my-services
my-services dev
my-services build
my-services doctor
```

Whether your project has 2 services or 20, DevPilot gives every developer the same clean workflow.

---

# Why DevPilot?

Modern applications rarely consist of a single project.

```text
my-project/
├── backend/
├── frontend/
├── admin/
├── landing/
├── docs/
└── worker/
```

Without DevPilot, developers often need to:

* Open multiple terminal windows
* Navigate between directories repeatedly
* Remember different commands for every service
* Create custom shell scripts
* Spend extra time onboarding new team members

DevPilot removes that friction by configuring your workspace once and exposing a single project command.

```bash
my-services
```

No more remembering where everything lives.

---

# Why not just use Turborepo, Nx or Docker Compose?

Because they solve different problems.

| Tool                      | Primary Purpose                                |
| ------------------------- | ---------------------------------------------- |
| **Turborepo**             | Task pipelines, caching and incremental builds |
| **Nx**                    | Monorepo architecture and task execution       |
| **Docker Compose**        | Container orchestration                        |
| **npm / pnpm Workspaces** | Package management                             |
| **DevPilot**              | Local developer workspace management           |

DevPilot **does not replace** these tools.

Instead, it works alongside them.

For example, your project may already use Turborepo for builds and Docker Compose for containers. DevPilot simply becomes the single entry point that developers use every day.

```bash
my-services
```

From there they can:

* Start development servers
* Install dependencies
* Build services
* Run lint checks
* See running services
* Follow service logs
* Restart or stop services
* Clean generated files
* Verify project health
* Update repositories

One command.

One workflow.

---

# Features

* 🚀 One memorable command per project
* ⚡ Interactive terminal interface
* 📦 Supports npm, Yarn, pnpm and Bun
* 🔍 Automatically detects service folders
* 🛠 Guided project setup
* 🖥 Launch services in terminal tabs (where supported)
* 🧭 Workspace status for DevPilot-managed services
* 📜 Local service logs under `.devpilot/runtime/logs/`
* 🔁 Restart and stop services started by DevPilot
* 📂 Works from anywhere after setup
* 🧹 Built-in install, build, lint, clean, status, logs, stop, restart, doctor, update and upgrade commands
* 🔄 Automatic background update notifications with an interactive menu action
* 🔒 Keeps machine-specific configuration out of Git by default
* 🌎 Cross-platform

---

# Installation

Install globally.

```bash
npm install -g @cbhasib/devpilot
```

Or use your preferred package manager.

```bash
yarn global add @cbhasib/devpilot
```

```bash
pnpm add -g @cbhasib/devpilot
```

```bash
bun add -g @cbhasib/devpilot
```

Verify the installation.

```bash
devpilot --version
devpilot help
```

---

# Getting Started

Navigate to your project root.

```bash
cd /path/to/my-project
```

Run the setup wizard.

```bash
devpilot setup
```

DevPilot will guide you through:

* Project name
* Global command alias
* Package manager
* Launch mode
* Service discovery
* Development, build and lint commands

Example:

```text
Project Name : My Project
Alias        : my-services
Package      : yarn
Launch Mode  : tabs
```

After setup, DevPilot generates:

```text
.devpilot.json
```

and automatically adds the following to your project's `.gitignore`:

```gitignore
.devpilot.json
.devpilot/
```

This keeps machine-specific paths and preferences out of version control.

---

# Running Your Workspace

Open the interactive workspace.

```bash
my-services
```

Or execute commands directly.

```bash
my-services dev
my-services install
my-services build
my-services lint
my-services clean
my-services status
my-services logs
my-services restart backend
my-services stop
my-services doctor
my-services update
my-services upgrade
my-services about
```

Inside the project directory you can also use:

```bash
devpilot
devpilot dev
devpilot doctor
```

---

# Available Commands

| Command   | Description                                                                  |
| --------- | ---------------------------------------------------------------------------- |
| `dev`     | Start all configured services                                                |
| `install` | Install dependencies                                                         |
| `build`   | Build every configured service                                               |
| `lint`    | Run lint commands                                                            |
| `clean`   | Remove generated folders like `node_modules`, `.next`, `dist` and `coverage` |
| `status`  | Show DevPilot-managed service state and uptime                               |
| `logs`    | Follow logs for all services or a specific service                           |
| `stop`    | Stop all DevPilot-managed services or one named service                      |
| `restart` | Restart all runnable services or one named service                           |
| `doctor`  | Verify local tools and project configuration                                 |
| `update`  | Pull the latest Git changes and reinstall dependencies                       |
| `upgrade` | Update the DevPilot CLI itself                                               |
| `about`   | Display DevPilot information                                                 |

---

# Managing Running Services

DevPilot tracks only the services it starts. Runtime data stays local in:

```text
.devpilot/runtime/
├── logs/
└── registry.json
```

Check what is running.

```bash
my-services status
```

Follow logs without stopping services.

```bash
my-services logs
my-services logs backend
```

Restart or stop services.

```bash
my-services restart
my-services restart backend

my-services stop
my-services stop backend
```

DevPilot never scans for or kills random processes on your machine.

---

# Global Project Aliases

During setup, DevPilot creates a global command that points back to your project.

For example:

```bash
devpilot setup
```

Alias:

```text
my-services
```

Now you can run your workspace from anywhere.

```bash
cd ~

my-services
my-services dev
my-services build
```

No need to remember where the project lives.

---

# Update Notifications

DevPilot checks for new versions in the background (at most every 10 minutes) without slowing down your commands.

When an update is available, the interactive menu shows a compact update panel:

```text
▲ DevPilot update available            v0.5.0 -> v0.5.1
Press U in this menu or run devpilot upgrade
```

You can also update directly:

```bash
devpilot upgrade
```

For non-interactive environments:

```bash
devpilot upgrade --yes
```

The `update` command still belongs to your project: it pulls Git changes and reinstalls dependencies. Use `upgrade` when you want to update the DevPilot CLI itself.

Disable update checks if needed:

```bash
export DEVPILOT_NO_UPDATE_CHECK=1
```

Update checks are automatically skipped in CI and non-interactive environments.

---

# Example Project

```text
my-project/
├── backend/
├── frontend/
├── admin/
└── landing/
```

Configure once:

```bash
devpilot setup
```

Use forever:

```bash
my-services
```

---

# Author

**Hasibul Hasan**

GitHub: https://github.com/cbHasib

npm: https://www.npmjs.com/~cbhasib

Website: https://hasib.me

---

# License

MIT
