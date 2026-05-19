import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Codex CLI adapter. Codex does not
 * emit `SessionEnd` or `PreCompact`, so the lint tick that runs on
 * `SessionEnd` for Claude runs on `Stop` here instead. The list is the
 * source of truth consumed by `install()`, `doctorChecks()`, and the
 * `writeCodexHooks` settings writer.
 */
export const codexHookSpecs: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kb-capture.cjs' },
  { event: 'SessionStart', scriptPath: 'kb-session-start.cjs' },
  { event: 'SessionStart', scriptPath: 'kb-proposal-drain.cjs', async: true },
  { event: 'Stop', scriptPath: 'kb-lint-tick.cjs' },
];
