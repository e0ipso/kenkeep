import type { HookSpec } from '../types.js';

/**
 * Canonical hook declarations for the Kiro CLI adapter.
 *
 * Kiro CLI fires per-event lifecycle hooks configured in an agent JSON file
 * (`.kiro/agents/kk-hooks.json`). kenkeep writes that file during `init` via
 * `writeKiroHookConfig`. Each entry maps to a compiled `.cjs` hook script
 * installed under `.ai/kenkeep/hooks/kiro/`.
 *
 * Events and their kenkeep mappings:
 *
 *   agentSpawn       → kk-session-start  (sync; stdout injected into context)
 *   agentSpawn       → kk-proposal-drain (async via asyncLauncher)
 *   stop             → kk-capture        (sync; fires at end of each agent turn)
 *   stop             → kk-lint-tick      (async via asyncLauncher)
 *   userPromptSubmit → kk-prompt-context (sync; stdout injected into context)
 *
 * Exit code semantics (from Kiro CLI docs):
 *   0          → success; stdout added to agent context for agentSpawn and
 *                userPromptSubmit; ignored for stop
 *   2          → block execution (userPromptSubmit only; not used by kenkeep)
 *   other      → warning shown to user; execution continues
 *
 * Kiro has no native async hook mechanism, so non-blocking behaviour comes
 * from `asyncLauncher: true` in the hook script's own `runHookEntry` call —
 * the hook spawns a detached child and returns immediately, the same pattern
 * as Codex/Cursor/Copilot. The declarative `async` flag below is advisory
 * metadata for the support-matrix tests (it marks which hooks may not return
 * context to the host); `writeKiroHookConfig` does not read it, because Kiro's
 * config format has no async field to render it into.
 */
export const KIRO_HOOK_SPECS: readonly HookSpec[] = [
  { event: 'agentSpawn', scriptPath: 'kk-session-start.cjs' },
  { event: 'agentSpawn', scriptPath: 'kk-proposal-drain.cjs', async: true },
  { event: 'stop', scriptPath: 'kk-capture.cjs' },
  { event: 'stop', scriptPath: 'kk-lint-tick.cjs' },
  { event: 'userPromptSubmit', scriptPath: 'kk-prompt-context.cjs' },
];
