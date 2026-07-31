/**
 * agentSpawn hook (sync) for the Kiro CLI adapter.
 *
 * Injects the current `ENTRY.md` body (plus staleness and nudge lines) as
 * additional context at session start. Kiro adds stdout to the agent's
 * context when the hook exits 0, making this equivalent to Claude's
 * `additionalContext` channel.
 *
 * Payload received on stdin:
 *   { hook_event_name: "agentSpawn", cwd: "...", session_id: "..." }
 *
 * Output: plain text on stdout (not JSON-wrapped — Kiro's `agentSpawn`
 * injects raw stdout into context, unlike Codex which wraps in
 * `hookSpecificOutput`).
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
  tag: 'kiro:kk-session-start',
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
      // Kiro injects raw stdout into the agent context on agentSpawn exit 0.
      process.stdout.write(`${content}\n`);
      process.stderr.write(`${statusLine}\n`);
      process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
    } catch (err) {
      process.stderr.write(
        `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  },
});
