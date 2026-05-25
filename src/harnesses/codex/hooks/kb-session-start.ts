/**
 * SessionStart hook (sync) for the Codex CLI adapter.
 *
 * Emits the current `INDEX.md` body (plus the standard staleness and nudge
 * lines) as Codex's documented additionalContext payload. Codex consumes
 * `{ "additionalContext": "<text>" }` on stdout and injects the string into
 * the active session.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { buildSessionStartContext } from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[ai-knowledge-base]';
const HARD_DEADLINE_MS = 1000;

async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('codex:kb-session-start', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    process.stderr.write('📖 Index: Loading knowledge base…\n');
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const result = buildSessionStartContext({
      kbDir: paths.kbDir,
      nodesDir: paths.nodesDir,
      sessionsDir: paths.sessionsDir,
      stateFile: join(paths.stateDir, 'state.json'),
      lintStateFile: lintStateFile(paths.stateDir),
      threshold: settings.curationThreshold,
    });
    process.stdout.write(JSON.stringify({ additionalContext: result.additionalContext }));
    if (result.nudged) {
      process.stderr.write(
        `🔔 KB curation overdue: ${result.pendingSessions} pending, ${result.candidateCount} candidates — run /kb-curate\n`
      );
    } else {
      process.stderr.write(
        `📋 KB queue: ${result.pendingSessions} pending session log(s), ${result.candidateCount} candidate(s)\n`
      );
    }
    process.stderr.write('🧠 Index: Knowledge base loaded.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}

function readStdin(): Promise<string> {
  return new Promise(resolve => {
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

void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('codex:kb-session-start', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
