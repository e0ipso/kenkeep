/**
 * SessionEnd hook (async) for the Claude Code adapter.
 *
 * Increments a session counter on every fire. When the counter reaches the
 * configured `lintEveryNSessions` threshold, runs the lint library across
 * the nodes directory and persists the summary to `lint-state.json`.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { runLintTick } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { readStdin } from '../../../lib/stdin.js';

async function main(): Promise<void> {
  // Recursion guard: if the host spawned a nested `claude -p`, KENKEEP_BUILDER_INTERNAL=1
  // is set on the child and we must not re-enter the lint tick.
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('claude:kk-lint-tick', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  await runLintTick(startCwd, 'claude:kk-lint-tick');
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('claude:kk-lint-tick', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
