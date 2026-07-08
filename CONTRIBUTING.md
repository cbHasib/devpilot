# Contributing to DevPilot

DevPilot is a TypeScript CLI that compiles to CommonJS for npm distribution.

## Local Workflow

```bash
npm install
npm run typecheck
npm run build
npm run check
npm run pack:dry
```

`bin/devpilot.js` loads `dist/cli.js`, so build before testing the CLI locally.

## Project Structure

```text
src/
├── cli.ts                 CLI entry and command dispatch
├── commands/              User-facing command handlers
├── profiles/              Workspace profiles, hooks and launch scheduling
├── runtime/               Runtime registry, logs and managed process control
├── workspace/             Workspace scanning, summaries and validation
├── types.ts               Shared contributor-facing types
├── menu.ts                Interactive menu and update hotkey
├── setup.ts               Setup wizard
└── update-check.ts        npm version check and update banners
```

## Design Notes

- Keep command handlers lightweight. Shared behavior belongs in `profiles/`, `runtime/`, `workspace/` or `utils.ts`.
- Preserve backward compatibility for existing `.devpilot.json` files.
- Keep config fields JSON-friendly and human-readable.
- Do not make the menu own terminal raw mode directly. Use Clack prompts and AbortSignal-based shortcuts.
- Runtime process control must only target DevPilot-managed services recorded in `.devpilot/runtime/registry.json`.
- Add comments where behavior is surprising: terminal cleanup, process groups, update checks, profile filtering, hooks and dependency ordering.

## Release Checks

Before release, run:

```bash
npm run check
npm --cache /private/tmp/devpilot-npm-cache pack --dry-run
```

For menu or hotkey changes, also perform a TTY smoke test to confirm `Exit` actually terminates the process.
