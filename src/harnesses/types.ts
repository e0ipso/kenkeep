import type { ZodSchema } from 'zod';
import type { RepoPaths } from '../lib/paths.js';
import type { EffectiveSettings } from '../lib/settings.js';

/**
 * Opaque lifecycle event identifier. Each adapter declares its own event
 * vocabulary (Claude uses `SessionStart`/`SessionEnd`/`Stop`/..., Codex
 * reuses Claude names, OpenCode uses `session.created`/`session.idle`).
 * Shared code never narrows on canonical names; it iterates `adapter.hooks`.
 */
export type HookEvent = string;

/**
 * Canonical hook registration record. `scriptPath` is harness-relative
 * (e.g. `kb-capture.mjs` for Claude under `.claude/hooks/`).
 */
export interface HookSpec {
  event: HookEvent;
  scriptPath: string;
  matcher?: string;
  async?: boolean;
}

/**
 * Output of the harness-specific transcript parser. The capture pipeline
 * works only on this shape; each adapter is responsible for translating
 * its own native transcript representation into it.
 */
export interface RoleTaggedTranscript {
  interleaved: Array<{ role: 'user' | 'agent'; text: string }>;
}

/**
 * Generic options accepted by every adapter's headless LLM runner. Each
 * adapter owns its own per-harness option shape and validates it from the
 * opaque `harnessOpts` blob at the start of the call.
 */
export interface HeadlessRunOptions {
  timeoutMs?: number;
  logFile?: string;
  env?: NodeJS.ProcessEnv;
  onMessage?: (msg: HeadlessStreamMessage) => void;
  harnessOpts?: Record<string, unknown>;
}

export interface HeadlessStreamMessage {
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  [key: string]: unknown;
}

/**
 * On-disk paths owned by a single harness adapter. Each adapter returns
 * its own shape from `paths(root)`; the shared `RepoPaths` type carries
 * only harness-neutral locations.
 */
export interface HarnessPaths {
  /** Root directory the adapter writes into (e.g. `.claude/`, `.codex/`). */
  dir: string;
  /** Optional commands directory (Claude has one, Codex does not). */
  commandsDir?: string;
  /** Skills directory (`.claude/skills/`, `.agents/skills/`, ...). */
  skillsDir: string;
  /**
   * Hooks directory (`.claude/hooks/`, `.codex/hooks/`, ...). Omitted for
   * adapters whose extension surface is plugins rather than per-event shell
   * commands (OpenCode); those set `pluginsDir` instead.
   */
  hooksDir?: string;
  /**
   * Optional plugins directory (`.opencode/plugins/`). Set by adapters whose
   * host runtime expects a long-lived TS/JS module subscribing to an event
   * bus rather than per-event shell commands.
   */
  pluginsDir?: string;
  /** Optional adapter-specific settings file path. */
  settingsFile?: string;
}

export interface HarnessInstallOptions {
  /** Absolute path to the repository root. */
  root: string;
  /** Resolved repo paths (harness-neutral). */
  paths: RepoPaths;
  /** Absolute path to the package `templates/` directory. */
  templatesDir: string;
  /** True when called from `init --upgrade`; false on first install. */
  upgrade: boolean;
}

export type DoctorCheckLevel = 'error' | 'warn';

export type DoctorCheckResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string; level: DoctorCheckLevel };

export interface NamedDoctorCheck {
  name: string;
  result: DoctorCheckResult;
}

/**
 * Pluggable per-harness adapter. Every harness integration (Claude Code,
 * Codex CLI, OpenCode, ...) implements this interface in
 * `src/harnesses/<id>/` and registers itself in `src/harnesses/registry.ts`.
 */
export interface HarnessAdapter {
  /** Stable id used in `--harnesses` and stamped into `installed-version`. */
  readonly id: string;

  /** Hook lifecycle declarations this adapter actually registers. */
  readonly hooks: readonly HookSpec[];

  /** On-disk locations this adapter owns inside the consumer repo. */
  paths(root: string): HarnessPaths;

  /** Install templates and register hooks for a first-time install. */
  install(opts: HarnessInstallOptions): Promise<void>;

  /** Idempotently refresh templates and re-register hooks. */
  upgrade(opts: HarnessInstallOptions): Promise<void>;

  /**
   * Parse the harness's transcript file into the canonical role-tagged
   * structure. Each implementation owns the format (e.g. Claude's JSONL).
   */
  parseTranscript(text: string): RoleTaggedTranscript;

  /** Render a role-tagged transcript into the human-readable `[USER]:` / `[AGENT]:` form. */
  renderTranscript(t: RoleTaggedTranscript): string;

  /**
   * Spawn the harness's headless LLM driver (e.g. `claude -p`) and validate
   * the structured result against the provided Zod schema. The adapter
   * reads its per-harness knobs from `opts.harnessOpts`.
   */
  runHeadless<T>(
    promptBody: string,
    stdin: string,
    schema: ZodSchema<T>,
    opts?: HeadlessRunOptions
  ): Promise<T>;

  /**
   * Translates the loaded settings into an adapter-specific `harnessOpts`
   * blob the wrapper passes through to `runHeadless`. Adapters whose
   * discriminator does not match any of the configured per-call model
   * choices return `{}` so the underlying CLI falls back to its own
   * defaults.
   */
  buildHarnessOpts(settings: EffectiveSettings, role: ModelChoiceRole): Record<string, unknown>;

  /** Harness-specific doctor checks (CLI on PATH, hooks registered, skills present, ...). */
  doctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]>;

  /**
   * Returns true when this harness is the one currently driving the
   * process. The detector inspects the env vars the harness itself sets
   * (e.g. `CLAUDECODE=1` for Claude Code). Used by `resolveActiveHarness`
   * so the CLI, slash commands, and the headless runners pick the right
   * adapter when invoked from inside a session without an explicit
   * `--harness` flag.
   *
   * Returning `false` is also fine; if no adapter claims the env we fall
   * back to the configured default in `config.yaml`, then to the first
   * registered harness.
   */
  detectFromEnv?(env: NodeJS.ProcessEnv): boolean;
}

/**
 * Which of the three configurable model-choice settings (`proposalModel`,
 * `curatorModel`, `bootstrapModel`) the adapter should map into a
 * `harnessOpts` blob.
 */
export type ModelChoiceRole = 'proposal' | 'curator' | 'bootstrap';

export const ok = (detail: string): DoctorCheckResult => ({ ok: true, detail });
export const errCheck = (detail: string): DoctorCheckResult => ({
  ok: false,
  level: 'error',
  detail,
});
export const warnCheck = (detail: string): DoctorCheckResult => ({
  ok: false,
  level: 'warn',
  detail,
});
