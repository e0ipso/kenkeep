/**
 * SessionStart hook (sync) for the Claude Code adapter.
 *
 * Injects the current `ENTRY.md` body as additionalContext, optionally
 * appends a stale-entry warning, and optionally appends a curate nudge
 * when the pending-session backlog exceeds the threshold.
 *
 * Output format: a JSON object on stdout matching Claude Code's
 * `hookSpecificOutput.additionalContext` convention. Configured in
 * `.claude/settings.json` without `async: true` so stdout actually flows
 * back into the parent session.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHookEntry } from '../../../lib/hook-entry.js';
import {
  buildNudgeContent,
  buildSessionStartContext,
  sendSessionStartNotifications,
} from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[kenkeep]';

runHookEntry({
  tag: 'claude:kk-session-start',
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
      sendSessionStartNotifications(settings, result);
      const { statusLine, content } = buildNudgeContent(result);
      process.stdout.write(
        `${JSON.stringify({
          systemMessage: statusLine,
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: content,
          },
        })}\n`
      );
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
