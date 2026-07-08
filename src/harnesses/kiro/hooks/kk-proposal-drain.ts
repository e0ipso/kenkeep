/**
 * agentSpawn hook (async via launcher) for the Kiro CLI adapter.
 *
 * Drains the proposal queue by running headless `kiro-cli-chat` for each
 * pending session log. Kiro has no native async hook support, so
 * non-blocking behavior comes from the async launcher: the hook returns
 * immediately and the drain continues in a detached worker process — the
 * same pattern as Codex/Cursor/Copilot.
 *
 * Payload received on stdin:
 *   { hook_event_name: "agentSpawn", cwd: "...", session_id: "..." }
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessKiro } from '../headless.js';
import { buildKiroHarnessOpts } from '../opts.js';

runHookEntry({
  tag: 'kiro:kk-proposal-drain',
  asyncLauncher: true,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
    await runProposalDrain({
      binaryName: 'kiro-cli-chat',
      startCwd,
      runner: async (prompt, stdin, schema, opts) => runHeadlessKiro(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildKiroHarnessOpts(settings, 'proposal'),
      harnessTag: 'kiro:kk-proposal-drain',
    });
  },
});
