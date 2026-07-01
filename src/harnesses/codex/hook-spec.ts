import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Codex CLI adapter. Codex emits no
 * `SessionEnd`, so the lint tick that runs on `SessionEnd` for Claude runs
 * on `Stop` here instead. `PreCompact` exists since Codex 0.139 (verified
 * against the published hooks reference) and captures the about-to-lose-
 * context moment, matching the Claude and Cursor adapters. The list is the
 * source of truth consumed by `install()`, `doctorChecks()`, and the
 * `writeCodexHooks` settings writer.
 *
 * Operational caveat: Codex requires one-time review/trust of non-managed
 * hooks (`/hooks` inside Codex) before it will execute them; `install()`
 * surfaces this after writing the config.
 */
export const codexHookSpecs: readonly HookSpec[] = [
  { event: 'Stop', scriptPath: 'kk-capture.cjs' },
  { event: 'PreCompact', scriptPath: 'kk-capture.cjs' },
  { event: 'SessionStart', scriptPath: 'kk-session-start.cjs' },
  { event: 'SessionStart', scriptPath: 'kk-proposal-drain.cjs', async: true },
  { event: 'Stop', scriptPath: 'kk-lint-tick.cjs' },
  // Prompt-time injection: Codex natively fires `UserPromptSubmit` with the
  // user's `prompt` and consumes a synchronous `hookSpecificOutput`
  // additionalContext reply. Synchronous (not routed through the async
  // launcher) so its stdout reaches the session.
  { event: 'UserPromptSubmit', scriptPath: 'kk-prompt-context.cjs' },
];
