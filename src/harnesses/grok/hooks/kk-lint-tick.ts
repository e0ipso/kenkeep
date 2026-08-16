/**
 * SessionEnd lint tick for Grok Build. Advisory; async-launcher so the host
 * hook slot is not blocked.
 */
import { runHookEntry } from '../../../lib/hook-entry.js';
import { runLintTick } from '../../../lib/lint-state.js';

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

runHookEntry({
  tag: 'grok:kk-lint-tick',
  asyncLauncher: true,
  main: async payload => {
    const startCwd = pickString(payload, 'cwd', 'workspaceRoot') ?? process.cwd();
    await runLintTick(startCwd, 'grok:kk-lint-tick');
  },
});
