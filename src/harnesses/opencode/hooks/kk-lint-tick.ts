/**
 * session.idle handler for the OpenCode adapter.
 *
 * OpenCode does not emit a SessionEnd analog, so the lint cadence rides
 * on session.idle (alongside kk-capture). Every fire increments a
 * session counter; only every Nth fire actually runs the lint and resets
 * the counter. N is configured via `lintEveryNSessions` in `config.yaml`.
 */
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { runLintTick } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { readStdin } from '../../../lib/stdin.js';

async function main(): Promise<void> {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('opencode:kk-lint-tick', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  await runLintTick(startCwd, 'opencode:kk-lint-tick');
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('opencode:kk-lint-tick', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
