/**
 * SessionStart hook (sync).
 *
 * Injects the current `INDEX.md` body as additionalContext, optionally
 * appends a stale-INDEX warning, and optionally appends a curate nudge
 * when the pending-session backlog exceeds the threshold (hourly throttle).
 *
 * Output format: a JSON object on stdout matching Claude Code's
 * `hookSpecificOutput.additionalContext` convention. Configured in
 * `.claude/settings.json` without `async: true` so stdout actually flows
 * back into the parent session.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSessionStartContext } from '../lib/session-start.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

const PACKAGE_TAG = '[ai-knowledge-base]';
const HARD_DEADLINE_MS = 1000;

async function main(): Promise<void> {
  // Recursion guard: stage-2 drain spawns `claude -p` which itself fires
  // SessionStart. The drain runner sets KB_BUILDER_INTERNAL=1 on every
  // child so this hook exits silently in that case.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  // Hard wall-clock deadline so a slow filesystem can't block session
  // start. unref() so the timer does not pin the event loop.
  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch {
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  ensureStateLayout(paths);
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const result = buildSessionStartContext({
      kbDir: paths.kbDir,
      nodesDir: paths.nodesDir,
      sessionsDir: paths.sessionsDir,
      stateFile: join(paths.stateDir, 'state.json'),
      threshold: settings.curationThreshold,
    });
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: result.additionalContext,
        },
      })}\n`,
    );
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

void main().catch(() => process.exit(0));
