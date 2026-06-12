/**
 * SessionStart hook (async) for the Claude Code adapter.
 *
 * No-op in interactive Claude sessions — proposal extraction runs inline
 * during `/kk-curate` instead of spawning a headless `claude -p` child.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';

runHookEntry({
  tag: 'claude:kk-proposal-drain',
  // No deadline — this hook is async and intentionally a no-op.
  // Recursion guard in the scaffold handles KENKEEP_BUILDER_INTERNAL.
  main: async () => {
    // Recursion guard: the drain itself spawns `claude -p`, which fires
    // SessionStart again inside the child. KENKEEP_BUILDER_INTERNAL=1 is set on
    // every child by runHeadlessClaude.
  },
});
