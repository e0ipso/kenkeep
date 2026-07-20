/**
 * stop hook (async via launcher) for the Kiro CLI adapter.
 *
 * Every N sessions (configured via `lintEveryNSessions` in config.yaml),
 * runs `kenkeep lint` on the knowledge base and sends an OS nudge if there
 * are findings. Routes through the async launcher so it never blocks the
 * stop event.
 *
 * Payload received on stdin:
 *   { hook_event_name: "stop", cwd: "...", session_id: "..." }
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'kiro:kk-lint-tick',
  asyncLauncher: true,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runLintTick(startCwd, 'kiro:kk-lint-tick');
  },
});
