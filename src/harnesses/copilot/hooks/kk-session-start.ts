/**
 * SessionStart hook for the GitHub Copilot CLI adapter.
 *
 * Copilot does not document a stdout context-injection channel on
 * `sessionStart` (unlike Claude's `additionalContext`). The v1 strategy is
 * to write the current entry-catalog content into `<root>/.github/copilot-instructions.md`
 * under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block, which
 * Copilot reads on session start. The rewrite is idempotent and preserves
 * any user-authored content outside the block. Errors go to stderr only and
 * the script always exits 0 so a stalled write never blocks the session.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { readStdin } from '../../../lib/stdin.js';
import { writeCopilotInstructionsSentinel } from '../hooks-config.js';

const HARD_DEADLINE_MS = 1000;
const PACKAGE_TAG = '[kenkeep]';

async function main(): Promise<void> {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('copilot:kk-session-start', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    process.stderr.write('📖 kenkeep Index: Refreshing Copilot instructions…\n');
    await writeCopilotInstructionsSentinel({
      dir: join(root, '.copilot'),
      hooksDir: join(root, '.copilot', 'hooks'),
      skillsDir: join(root, '.github', 'skills'),
    });
    process.stderr.write('🧠 kenkeep Index: Copilot instructions refreshed.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('copilot:kk-session-start', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
