/**
 * SessionStart proposal drain for Grok Build. Grok has no native async hook
 * flag, so this routes through the async launcher and spawns `grok -p`.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { runHeadlessGrok } from '../headless.js';
import { buildGrokHarnessOpts } from '../opts.js';

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

runHookEntry({
  tag: 'grok:kk-proposal-drain',
  asyncLauncher: true,
  main: async payload => {
    const startCwd = pickString(payload, 'cwd', 'workspaceRoot') ?? process.cwd();
    await runProposalDrain({
      binaryName: 'grok',
      startCwd,
      runner: async (prompt, stdin, schema, opts) => runHeadlessGrok(prompt, stdin, schema, opts),
      buildHarnessOpts: settings => buildGrokHarnessOpts(settings, 'proposal'),
      harnessTag: 'grok:kk-proposal-drain',
    });
  },
});
