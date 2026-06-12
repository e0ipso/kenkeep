/**
 * sessionEnd hook for the Cursor adapter (lint tick).
 *
 * Increments a session counter on every fire; runs lint every N sessions.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

runHookEntry({
  tag: 'cursor:kk-lint-tick',
  main: async payload => {
    const roots = payload['workspace_roots'];
    const startCwd =
      Array.isArray(roots) && typeof roots[0] === 'string' && roots[0].length > 0
        ? (roots[0] as string)
        : process.cwd();
    await runLintTick(startCwd, 'cursor:kk-lint-tick');
  },
});
