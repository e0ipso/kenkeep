/**
 * SessionStart hook for Grok Build.
 *
 * Grok ignores SessionStart stdout (no additionalContext). Orientation is
 * the static AGENTS.md kk-index pointer written by `init`. This hook only
 * computes nudges and fires OS notifications — it does not grow AGENTS.md.
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

function pickString(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

runHookEntry({
  tag: 'grok:kk-session-start',
  deadlineMs: 1000,
  main: async payload => {
    const startCwd = pickString(payload, 'cwd', 'workspaceRoot') ?? process.cwd();
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
      const { statusLine } = buildNudgeContent(result);
      process.stderr.write(`${statusLine}\n`);
      process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
