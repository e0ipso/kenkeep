/**
 * sessionStart hook for the Cursor adapter (proposal drain).
 *
 * Drains the proposal queue via `agent -p --output-format json`. Cursor has
 * no async hook support and waits for sessionStart hooks before the first
 * turn (measured: a pending backlog stalled session start by up to the full
 * 30s hook timeout, with Cursor killing the hook mid-LLM-run), so the hook
 * re-spawns itself detached and returns immediately; the drain runs in the
 * background child.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessCursor } from '../headless.js';
import { buildCursorHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'cursor:kk-proposal-drain',
  detach: true,
  main: async payload => {
    const roots = payload['workspace_roots'];
    const startCwd =
      Array.isArray(roots) && typeof roots[0] === 'string' && roots[0].length > 0
        ? (roots[0] as string)
        : process.cwd();
    await runProposalDrain({
      binaryName: 'agent',
      startCwd,
      runner: async (prompt, stdin, schema, opts) => runHeadlessCursor(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildCursorHarnessOpts(settings, 'proposal'),
      harnessTag: 'cursor:kk-proposal-drain',
    });
  },
});
