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
import { runHookEntry } from '../../../lib/hook-entry.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { writeCopilotInstructionsSentinel } from '../hooks-config.js';

const PACKAGE_TAG = '[kenkeep]';

runHookEntry({
  tag: 'copilot:kk-session-start',
  deadlineMs: 1000,
  main: async payload => {
    const startCwd =
      typeof payload['cwd'] === 'string' && (payload['cwd'] as string).length > 0
        ? (payload['cwd'] as string)
        : process.cwd();
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
  },
});
