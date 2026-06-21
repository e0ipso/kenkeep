/**
 * SessionStart hook for the Codex CLI adapter (proposal drain).
 *
 * Drains the proposal queue by spawning `codex exec --json` for each pending
 * session log. Codex's hook schema carries no async flag (the spec's
 * `async: true` is dropped by the writer), so non-blocking behavior comes from
 * the async launcher, not the host: the hook routes through it, returns
 * immediately, and the drain's headless LLM runs continue in the detached
 * worker instead of blocking session start.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessCodex } from '../headless.js';
import { buildCodexHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'codex:kk-proposal-drain',
  asyncLauncher: true,
  invalidJson: 'ignore',
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runProposalDrain({
      binaryName: 'codex',
      startCwd,
      runner: async (prompt, stdin, schema, opts) => runHeadlessCodex(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildCodexHarnessOpts(settings, 'proposal'),
      harnessTag: 'codex:kk-proposal-drain',
    });
  },
});
