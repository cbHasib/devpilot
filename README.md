# 🚀 DevPilot

> **One command. Every service. Any project.**

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
* 📂 Works from anywhere after setup
* 🧹 Built-in install, build, lint, clean, doctor and update commands
* 🔄 Automatic background update notifications
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
my-services doctor
my-services update
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
| `doctor`  | Verify local tools and project configuration                                 |
| `update`  | Pull the latest Git changes and reinstall dependencies                       |
| `about`   | Display DevPilot information                                                 |

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

DevPilot checks for new versions in the background (at most once per day) without slowing down your commands.

When an update is available you'll see:

```text
▲ Update available
v0.2.0 → v0.2.1

Run:

npm install -g @cbhasib/devpilot@latest
```

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
