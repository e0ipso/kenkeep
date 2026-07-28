/**
 * session.idle handler for the OpenCode adapter.
 *
 * OpenCode does not emit a SessionEnd analog, so the lint cadence rides
 * on session.idle (alongside kk-capture). Every fire increments a
 * session counter; only every Nth fire actually runs the lint and resets
 * the counter. N is configured via `lintEveryNSessions` in `config.yaml`.
 */
import { runHookEntry, hookStartCwd } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'opencode:kk-lint-tick',
  main: async payload => {
    const startCwd = hookStartCwd(payload);
    await runLintTick(startCwd, 'opencode:kk-lint-tick');
  },
});
