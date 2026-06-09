/**
 * Stop hook for the Codex CLI adapter.
 *
 * Codex does not emit a `SessionEnd` event, so the lint cadence rides on
 * `Stop`. Every fire increments a session counter; only every Nth fire
 * actually runs the lint and resets the counter. N is configured via
 * `lintEveryNSessions` in `config.yaml`.
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
      appendHookDiagnostic('codex:kk-lint-tick', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  await runLintTick(startCwd, 'codex:kk-lint-tick');
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('codex:kk-lint-tick', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
