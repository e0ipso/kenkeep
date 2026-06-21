import type { HookSpec } from '../types.js';

/**
 * Default per-hook timeout in seconds, encoded in each entry's `payload`
 * and rendered into the Copilot hook JSON by `writeCopilotHookConfig`.
 */
const DEFAULT_HOOK_TIMEOUT_SECONDS = 30;

/**
 * Note on the recursion guard: the hook entries deliberately carry NO static
 * `env`. The old config stamped `KENKEEP_BUILDER_INTERNAL=1` on every entry,
 * which made every hook script early-exit in EVERY session — live ones
 * included — so capture/injection/drain were no-ops in production. The guard
 * belongs on the headless runner's child env (`runHeadlessCopilot` sets it),
 * from where Copilot's hook subprocesses inherit it, suppressing hooks for
 * kenkeep-internal sessions only.
 */
function payload(): Record<string, unknown> {
  return { type: 'command', timeoutSec: DEFAULT_HOOK_TIMEOUT_SECONDS };
}

/**
 * Canonical hook declarations for the GitHub Copilot CLI adapter. Copilot
 * fires per-event lifecycle hooks configured by a JSON document under
 * `.github/hooks/` (repo-level; Copilot loads it before user-level
 * `~/.copilot/hooks/`). The list is the source of truth consumed by
 * `writeCopilotHookConfig` (which renders each entry into Copilot's native
 * array-per-event shape using the `payload` blob) and by `doctorChecks`.
 *
 * `scriptPath` is the bare script filename; the writer joins it with the
 * shared `.ai/kenkeep/hooks/copilot/` path in the consumer repo to build
 * the `bash` command Copilot runs.
 *
 * Events:
 *   sessionStart: writes the entry-catalog sentinel block, then drains proposals.
 *   sessionEnd:   captures the transcript, then ticks the periodic lint.
 *   agentStop:    captures again at each agent-turn boundary (Claude `Stop`
 *                 analog); the shared transcript_hash dedup keeps one log
 *                 per unique transcript.
 */
export const copilotHookSpecs: readonly HookSpec[] = [
  { event: 'sessionStart', scriptPath: 'kk-session-start.cjs', payload: payload() },
  { event: 'sessionStart', scriptPath: 'kk-proposal-drain.cjs', async: true, payload: payload() },
  { event: 'sessionEnd', scriptPath: 'kk-capture.cjs', payload: payload() },
  { event: 'sessionEnd', scriptPath: 'kk-lint-tick.cjs', payload: payload() },
  { event: 'agentStop', scriptPath: 'kk-capture.cjs', payload: payload() },
];
