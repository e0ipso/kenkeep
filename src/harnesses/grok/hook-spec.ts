import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Grok Build TUI adapter.
 *
 * Grok uses Claude-shaped event names (`SessionStart`, `Stop`, …) and a
 * Claude-shaped hook JSON document under `.grok/hooks/kk.json`. SessionStart
 * and UserPromptSubmit stdout are ignored by Grok, so there is no
 * `kk-prompt-context` hook and SessionStart does not rely on additionalContext.
 */
export const grokHookSpecs: readonly HookSpec[] = [
  { event: 'SessionStart', scriptPath: 'kk-session-start.cjs' },
  { event: 'SessionStart', scriptPath: 'kk-proposal-drain.cjs', async: true },
  { event: 'Stop', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionEnd', scriptPath: 'kk-lint-tick.cjs', async: true },
  { event: 'PreCompact', scriptPath: 'kk-capture.cjs' },
];
