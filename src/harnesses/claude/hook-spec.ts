import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Claude Code adapter. The list is
 * the source of truth consumed by `install()`, `doctorChecks()`, and the
 * `writeClaudeHookConfig` settings writer.
 */
export const CLAUDE_HOOK_SPECS: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionEnd', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionEnd', scriptPath: 'kb-lint-tick.mjs', async: true },
  { event: 'PreCompact', scriptPath: 'kb-capture.mjs' },
  { event: 'SessionStart', scriptPath: 'kb-proposal-drain.mjs', async: true },
  { event: 'SessionStart', scriptPath: 'kb-session-start.mjs' },
];
