/**
 * SessionStart hook for the GitHub Copilot CLI adapter (proposal drain).
 *
 * Drains the proposal queue by spawning `copilot -p` for each pending
 * session log. Copilot's hook config carries no async mechanism and caps
 * hooks at timeoutSec, so the hook re-spawns itself detached and returns
 * immediately; the drain's headless LLM runs continue in the background
 * child instead of blocking session start.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessCopilot } from '../headless.js';
import { buildCopilotHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'copilot:kk-proposal-drain',
  detach: true,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runProposalDrain({
      binaryName: 'copilot',
      startCwd,
      runner: async (prompt, stdin, schema, opts) =>
        runHeadlessCopilot(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildCopilotHarnessOpts(settings, 'proposal'),
      harnessTag: 'copilot:kk-proposal-drain',
    });
  },
});
