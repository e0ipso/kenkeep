/**
 * SessionStart hook (sync) for the GitHub Copilot CLI adapter.
 *
 * Emits the shared-builder output (entry catalog, descent directive,
 * staleness/curation attention block, nudge directive) through Copilot's
 * documented private session channel: a top-level
 * `{ "additionalContext": string }` JSON object on stdout. Copilot CLI
 * injects it into the conversation (hooks reference; shipped in CLI 1.0.11,
 * multiple sessionStart contributions are concatenated in execution order).
 *
 * Nothing is written to `.github/copilot-instructions.md` here: that
 * tracked, team-shared file carries only the static pointer block the
 * installer writes, so hostname, queue counts and the nudge directive never
 * dirty a committed file. Status lines go to stderr only; the script always
 * exits 0 so a failure never blocks the session.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHookEntry } from '../../../lib/hook-entry.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';
import {
  buildNudgeContent,
  buildSessionStartContext,
  sendSessionStartNotifications,
} from '../../../lib/session-start.js';

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
      process.stderr.write('📖 kenkeep Index: Loading knowledge base…\n');
      const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
      const result = buildSessionStartContext({
        kkDir: paths.kkDir,
        nodesDir: paths.nodesDir,
        sessionsDir: paths.sessionsDir,
        stateFile: join(paths.stateDir, 'state.json'),
        lintStateFile: lintStateFile(paths.stateDir),
        threshold: settings.curationThreshold,
      });
      sendSessionStartNotifications(settings, result, paths.kkDir);
      const { statusLine, content } = buildNudgeContent(result);
      process.stdout.write(`${JSON.stringify({ additionalContext: content })}\n`);
      process.stderr.write(`${statusLine}\n`);
      process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
