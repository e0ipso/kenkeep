/**
 * Stop hook for the Codex CLI adapter.
 *
 * Codex does not emit a `SessionEnd` event, so the lint cadence rides on
 * `Stop`. Every fire increments a session counter; only every Nth fire
 * actually runs the lint and resets the counter. N is configured via
 * `lintEveryNSessions` in `config.yaml`.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'codex:kk-lint-tick',
  // No deadline — Codex hooks are not timed the same way.
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runLintTick(startCwd, 'codex:kk-lint-tick');
  },
});
