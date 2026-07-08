'use strict';

/**
 * A single service managed by DevPilot.
 *
 * Values map directly to `.devpilot.json`; optional fields such as
 * `dependsOn` and `delay` are intentionally plain JSON so configs stay
 * human-readable and easy to review.
 */
export interface ServiceConfig {
  dir: string;
  name: string;
  dev: string;
  build: string;
  lint: string;
  color?: string;
  framework?: string;
  port?: number | null;
  dependsOn?: string[];
  delay?: number;
}

/** A normalized workspace profile after reading `.devpilot.json`. */
export interface WorkspaceProfile {
  id: string;
  name: string;
  services: string[];
  env: Record<string, string>;
  raw?: unknown;
}

/** The on-disk JSON shape for a workspace profile. */
export type WorkspaceProfileDefinition =
  | string[]
  | {
      name?: string;
      services?: string[];
      env?: Record<string, string | number | boolean | null>;
    };

/** High-level workspace metadata stored in `.devpilot.json`. */
export interface WorkspaceInfo {
  type: string;
  id?: string;
  source?: string;
  monorepo?: boolean;
}

/** Normalized DevPilot configuration used by commands at runtime. */
export interface DevPilotConfig {
  schemaVersion: number;
  projectName: string;
  alias: string;
  packageManager: string;
  launchMode: 'tabs' | 'current';
  editor: string;
  services: ServiceConfig[];
  createdAt?: string;
  lastUpdated?: string;
  devpilotVersion?: string;
  workspace: WorkspaceInfo;
  features?: Record<string, unknown>;
  profiles?: Record<string, WorkspaceProfileDefinition>;
  hooks?: Record<string, string[]>;
  activeProfile?: Pick<WorkspaceProfile, 'id' | 'name' | 'env'>;
  _configError?: string | null;
}

/** Shared command context passed through the CLI dispatcher. */
export interface ProjectContext {
  root: string;
  configPath?: string;
  config: DevPilotConfig;
  allServices?: ServiceConfig[];
  activeProfile?: Pick<WorkspaceProfile, 'id' | 'name' | 'env'>;
  profileEnv?: Record<string, string>;
}

/** Registry entry written under `.devpilot/runtime/registry.json`. */
export interface RuntimeEntry {
  key: string;
  serviceName: string;
  serviceDir: string;
  pid?: number | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  cwd?: string;
  command?: string;
  status?: 'running' | 'exited' | 'failed' | 'stopped' | 'unknown';
  exitCode?: number | null;
  platform?: NodeJS.Platform;
  launchMode?: string;
  logPath?: string;
  port?: number | null;
  framework?: string;
  terminalSession?: string | null;
  updatedAt?: string;
}

/** Descriptive warning surfaced by `devpilot doctor`. */
export interface ValidationWarning {
  code: string;
  message: string;
  guidance: string;
  severity: 'warning';
}

/** Metadata returned by the npm update checker. */
export interface UpdateInfo {
  packageName: string;
  current: string;
  latest: string;
  command: string;
  installCommand: string;
}

/** Keyboard payload used by raw terminal prompts and shortcut listeners. */
export interface KeypressInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  sequence?: string;
}

/** Option metadata shared by select/search prompts. */
export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  hint?: string;
  shortcut?: string;
  shortcutLabel?: string;
  disabled?: boolean;
}

/** Command registry entry consumed by the CLI dispatcher. */
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  hidden?: boolean;
  requiresContext?: boolean;
  profileMode?: 'strict' | 'target';
  handler: (context?: ProjectContext | null, args?: string[], runCommand?: Function) => unknown;
}
