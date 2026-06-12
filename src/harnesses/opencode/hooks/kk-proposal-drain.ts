/**
 * session.created async handler for the OpenCode adapter.
 *
 * Drains the proposal queue by spawning `opencode run --format json` for
 * each pending session log. Marked async in the hook spec so it never
 * blocks the agent.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessOpenCode } from '../headless.js';
import { buildOpenCodeHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'opencode:kk-proposal-drain',
  // No detach — OpenCode marks the hook async in its spec so it never
  // blocks the agent; no detach workaround needed.
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runProposalDrain({
      binaryName: 'opencode',
      startCwd,
      runner: async (prompt, stdin, schema, opts) =>
        runHeadlessOpenCode(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildOpenCodeHarnessOpts(settings, 'proposal'),
      harnessTag: 'opencode:kk-proposal-drain',
    });
  },
});
