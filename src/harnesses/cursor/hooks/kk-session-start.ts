/**
 * sessionStart hook for the Cursor adapter.
 *
 * Emits entry-catalog context using Cursor's native `{ "additional_context": "..." }`
 * stdout envelope.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { buildNudgeContent, buildSessionStartContext } from '../../../lib/session-start.js';
import { lintStateFile } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';
import { readStdin } from '../../../lib/stdin.js';

const PACKAGE_TAG = '[kenkeep]';
const HARD_DEADLINE_MS = 1000;

async function main(): Promise<void> {
  if (process.env['KENKEEP_BUILDER_INTERNAL'] === '1') return;

  const deadline = setTimeout(() => process.exit(0), HARD_DEADLINE_MS);
  deadline.unref();

  const raw = await readStdin();
  let input: { workspace_roots?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { workspace_roots?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('cursor:kk-session-start', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const roots = input.workspace_roots;
  const startCwd =
    Array.isArray(roots) && typeof roots[0] === 'string' && roots[0].length > 0
      ? (roots[0] as string)
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
    const { statusLine, content: context } = buildNudgeContent(result);
    process.stdout.write(JSON.stringify({ additional_context: context }));
    process.stderr.write(`${statusLine}\n`);
    process.stderr.write('🧠 kenkeep Index: Knowledge base loaded.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} session-start error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}


void main().catch((err: unknown) => {
  try {
    const paths = repoPaths(findRepoRoot(process.cwd()));
    appendHookDiagnostic('cursor:kk-session-start', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
