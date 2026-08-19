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
 *   agentSpawn         → kk-session-start  (sync; stdout injected into context)
 *   agentSpawn (async) → kk-proposal-drain (async via asyncLauncher)
 *   stop               → kk-capture        (sync; fires at end of each agent turn)
 *   stop               → kk-lint-tick      (sync; periodic lint check)
 *   userPromptSubmit   → kk-prompt-context (sync; stdout injected into context)
 *
 * Exit code semantics (from Kiro CLI docs):
 *   0          → success; stdout added to agent context for agentSpawn and
 *                userPromptSubmit; ignored for stop
 *   2          → block execution (userPromptSubmit only; not used by kenkeep)
 *   other      → warning shown to user; execution continues
 *
 * The `async` flag on kk-proposal-drain is consumed by the async-launcher
 * path in the hook script itself (`asyncLauncher: true` in runHookEntry).
 * Kiro does not have a native async hook mechanism, so the hook returns
 * immediately after spawning a detached child — same pattern as
 * Codex/Cursor/Copilot.
 */
export const KIRO_HOOK_SPECS: readonly HookSpec[] = [
  { event: 'agentSpawn', scriptPath: 'kk-session-start.cjs' },
  { event: 'agentSpawn', scriptPath: 'kk-proposal-drain.cjs', async: true },
  { event: 'stop', scriptPath: 'kk-capture.cjs' },
  { event: 'stop', scriptPath: 'kk-lint-tick.cjs' },
  { event: 'userPromptSubmit', scriptPath: 'kk-prompt-context.cjs' },
];
