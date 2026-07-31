/**
 * sessionEnd hook for the Cursor adapter (lint tick).
 *
 * Increments a session counter on every fire; runs lint every N sessions.
 * Cursor has no native async hook support, so this advisory worker routes
 * through the async launcher: it returns immediately and runs in a detached
 * child, freeing the host hook slot.
 */
import { runHookEntry, hookStartCwd } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'cursor:kk-lint-tick',
  asyncLauncher: true,
  main: async payload => {
    const startCwd = hookStartCwd(payload, 'workspace_roots');
    await runLintTick(startCwd, 'cursor:kk-lint-tick');
  },
});
