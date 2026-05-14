import type { ZodSchema } from 'zod';
import type { EffortLevel, ModelFamily } from '../lib/schemas.js';
import type { RepoPaths } from '../lib/paths.js';

/**
 * Canonical KB hook events. Adapters map these to harness-native event names
 * inside their own configuration writer; the rest of the codebase only ever
 * sees this vocabulary.
 */
export type HookEvent = 'Stop' | 'SessionEnd' | 'PreCompact' | 'SessionStart' | 'UserPromptSubmit';

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
 * Options accepted by every adapter's headless LLM runner. Mirrors the
 * historical `RunHeadlessOptions` so existing call sites (curator, drain,
 * bootstrap) work unchanged.
 */
export interface HeadlessRunOptions {
  timeoutMs?: number;
  allowedTools?: string[];
  logFile?: string;
  env?: NodeJS.ProcessEnv;
  model?: ModelFamily;
  effort?: EffortLevel;
  onMessage?: (msg: HeadlessStreamMessage) => void;
}

export interface HeadlessStreamMessage {
  type?: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  [key: string]: unknown;
}

export interface HarnessInstallOptions {
  /** Absolute path to the repository root. */
  root: string;
  /** Resolved repo paths (so adapters do not recompute them). */
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
 * Pluggable per-harness adapter. Every assistant integration (Claude Code,
 * Codex CLI, OpenCode, …) implements this interface in
 * `src/harnesses/<id>/` and registers itself in `src/harnesses/registry.ts`.
 */
export interface HarnessAdapter {
  /** Stable id used in `--assistants` and stamped into `installed-version`. */
  readonly id: string;

  /** Canonical hook lifecycle declarations for this harness. */
  readonly hooks: readonly HookSpec[];

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
   * the structured result against the provided Zod schema.
   */
  runHeadless<T>(
    promptBody: string,
    stdin: string,
    schema: ZodSchema<T>,
    opts?: HeadlessRunOptions
  ): Promise<T>;

  /** Harness-specific doctor checks (CLI on PATH, hooks registered, skills present, …). */
  doctorChecks(paths: RepoPaths): Promise<NamedDoctorCheck[]>;
}

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
