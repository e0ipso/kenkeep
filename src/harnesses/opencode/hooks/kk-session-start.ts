/**
 * session.created handler for the OpenCode adapter.
 *
 * OpenCode plugins have no v1 equivalent of Claude's
 * `{additionalContext}` stdout channel. To get the ENTRY.md context in
 * front of the agent at session start, this script writes the context
 * payload to `.opencode/AGENTS.md` (a location OpenCode reads at agent
 * resolution time when the user references it from a parent AGENTS.md).
 * Users opt in by referencing `.opencode/AGENTS.md` from their primary
 * agent doc; the file is overwritten on every session.created firing.
 *
 * The plugin shim runs this child after `KENKEEP_BUILDER_INTERNAL=1` is set,
 * which the script honors by exiting silently to avoid recursion when
 * our own headless runner spawns `opencode run`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runHookEntry } from '../../../lib/hook-entry.js';
import {
  buildNudgeContent,
  buildSessionStartContext,
  buildSessionStartNotifications,
} from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { sendOsNotification } from '../../../lib/notifications.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[kenkeep]';
const AGENTS_HEADER = `<!-- ${PACKAGE_TAG} auto-generated session-start context. Re-run init to remove. -->\n`;

runHookEntry({
  tag: 'opencode:kk-session-start',
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
      if (settings.notifications.enabled) {
        for (const notification of buildSessionStartNotifications(result)) {
          sendOsNotification(notification);
        }
      }
      const { statusLine, content } = buildNudgeContent(result);
      const target = join(root, '.opencode', 'AGENTS.md');
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, `${AGENTS_HEADER}${content}`);
      process.stderr.write(`${statusLine}\n`);
      process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
