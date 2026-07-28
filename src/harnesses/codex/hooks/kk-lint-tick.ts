/**
 * Stop hook for the Codex CLI adapter.
 *
 * Codex does not emit a `SessionEnd` event, so the lint cadence rides on
 * `Stop`. Every fire increments a session counter; only every Nth fire
 * actually runs the lint and resets the counter. N is configured via
 * `lintEveryNSessions` in `config.yaml`.
 *
 * Codex has no native async hook support, so this advisory worker routes
 * through the async launcher: it returns immediately and runs in a detached
 * child, freeing the host hook slot.
 */
import { runHookEntry, hookStartCwd } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'codex:kk-lint-tick',
  asyncLauncher: true,
  invalidJson: 'ignore',
  main: async payload => {
    const startCwd = hookStartCwd(payload);
    await runLintTick(startCwd, 'codex:kk-lint-tick');
  },
});
