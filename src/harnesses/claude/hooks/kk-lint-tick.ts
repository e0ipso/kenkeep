/**
 * SessionEnd hook (async) for the Claude Code adapter.
 *
 * Increments a session counter on every fire. When the counter reaches the
 * configured `lintEveryNSessions` threshold, runs the lint library across
 * the nodes directory and persists the summary to `lint-state.json`.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { runHookEntry, hookStartCwd } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'claude:kk-lint-tick',
  // No deadline — configured async in .claude/settings.json.
  main: async payload => {
    const startCwd = hookStartCwd(payload);
    await runLintTick(startCwd, 'claude:kk-lint-tick');
  },
});
