/**
 * sessionStart hook for the Cursor adapter (proposal drain).
 *
 * Drains the proposal queue via `agent -p --output-format json`. Cursor has
 * no async hook support and waits for sessionStart hooks before the first
 * turn (measured: a pending backlog stalled session start by up to the full
 * 30s hook timeout, with Cursor killing the hook mid-LLM-run), so the hook
 * routes through the async launcher and returns immediately; the drain runs in
 * the detached worker.
 */
import { runHookEntry, hookStartCwd } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessCursor } from '../headless.js';
import { buildCursorHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'cursor:kk-proposal-drain',
  asyncLauncher: true,
  main: async payload => {
    const startCwd = hookStartCwd(payload, 'workspace_roots');
    await runProposalDrain({
      binaryName: 'agent',
      startCwd,
      runner: async (prompt, stdin, schema, opts) => runHeadlessCursor(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildCursorHarnessOpts(settings, 'proposal'),
      harnessTag: 'cursor:kk-proposal-drain',
    });
  },
});
