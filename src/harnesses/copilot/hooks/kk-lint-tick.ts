/**
 * SessionEnd hook for the GitHub Copilot CLI adapter.
 *
 * The periodic-lint cadence rides on Copilot's `sessionEnd` event (the
 * SessionEnd analog). Every fire increments a session counter; only every
 * Nth fire actually runs the lint and resets the counter. N is configured
 * via `lintEveryNSessions` in `config.yaml`.
 *
 * Copilot has no native async hook support, so this advisory worker routes
 * through the async launcher: it returns immediately and runs in a detached
 * child, freeing the host hook slot.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'copilot:kk-lint-tick',
  asyncLauncher: true,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runLintTick(startCwd, 'copilot:kk-lint-tick');
  },
});
