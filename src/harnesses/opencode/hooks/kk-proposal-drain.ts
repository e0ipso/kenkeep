/**
 * session.created async handler for the OpenCode adapter.
 *
 * Drains the proposal queue by spawning `opencode run --format json` for
 * each pending session log. Marked async in the hook spec so it never
 * blocks the agent.
 */
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { runProposalDrain } from '../../../lib/proposal-drain.js';
import { readStdin } from '../../../lib/stdin.js';
import { runHeadlessOpenCode } from '../headless.js';
import { buildOpenCodeHarnessOpts } from '../opts.js';

async function main(): Promise<void> {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('opencode:kk-proposal-drain', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  await runProposalDrain({
    binaryName: 'opencode',
    startCwd,
    runner: async (prompt, stdin, schema, opts) => runHeadlessOpenCode(prompt, stdin, schema, opts),
    buildHarnessOpts: settings => buildOpenCodeHarnessOpts(settings, 'proposal'),
    harnessTag: 'opencode:kk-proposal-drain',
  });
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('opencode:kk-proposal-drain', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
