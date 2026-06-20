import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Claude Code adapter. The list is
 * the source of truth consumed by `install()`, `doctorChecks()`, and the
 * `writeClaudeHookConfig` settings writer.
 *
 * The `UserPromptSubmit` entry is the adapter's prompt-time injection
 * capability: Claude Code natively fires `UserPromptSubmit` with the user's
 * `prompt`, and consumes a synchronous `hookSpecificOutput.additionalContext`
 * reply. It is deliberately NOT `async` (an async hook's stdout is discarded,
 * so it could not inject context).
 */
export const CLAUDE_HOOK_SPECS: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kk-lint-tick.cjs', async: true },
  { event: 'PreCompact', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionStart', scriptPath: 'kk-proposal-drain.cjs', async: true },
  { event: 'SessionStart', scriptPath: 'kk-session-start.cjs' },
  { event: 'UserPromptSubmit', scriptPath: 'kk-prompt-context.cjs' },
];
