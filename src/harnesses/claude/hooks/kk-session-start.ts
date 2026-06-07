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
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { readStdin } from '../../../lib/stdin.js';
import { buildSessionStartContext } from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[kenkeep]';
const HARD_DEADLINE_MS = 1000;

async function main(): Promise<void> {
  // Recursion guard: the proposal drain spawns `claude -p` which itself
  // fires SessionStart. The drain runner sets KENKEEP_BUILDER_INTERNAL=1 on every
  // child so this hook exits silently in that case.
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  // Hard wall-clock deadline so a slow filesystem can't block session
  // start. unref() so the timer does not pin the event loop.
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('claude:kk-session-start', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
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
    const statusLine = result.nudged
      ? `🚨 kenkeep curation overdue: ${result.pendingSessions} pending, ${result.candidateCount} candidates — run /kk-curate`
      : `📋 kenkeep queue: ${result.pendingSessions} pending session log(s), ${result.candidateCount} candidate(s)`;
    process.stdout.write(
      `${JSON.stringify({
        systemMessage: statusLine,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: result.additionalContext,
        },
      })}\n`
    );
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}


void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('claude:kk-session-start', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
