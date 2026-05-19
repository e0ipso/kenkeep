import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Claude Code adapter. The list is
 * the source of truth consumed by `install()`, `doctorChecks()`, and the
 * `writeClaudeHookConfig` settings writer.
 */
export const CLAUDE_HOOK_SPECS: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kb-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kb-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kb-lint-tick.cjs', async: true },
  { event: 'PreCompact', scriptPath: 'kb-capture.cjs' },
  { event: 'SessionStart', scriptPath: 'kb-proposal-drain.cjs', async: true },
  { event: 'SessionStart', scriptPath: 'kb-session-start.cjs' },
];
