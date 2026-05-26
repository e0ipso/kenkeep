/**
 * SessionEnd hook (async) for the Claude Code adapter.
 *
 * Increments a session counter on every fire. When the counter reaches the
 * configured `lintEveryNSessions` threshold, runs the lint library across
 * the nodes directory and persists the summary to `lint-state.json`.
 *
 * Configured in `.claude/settings.json` with `"async": true` so its stdout
 * does not flow back into the parent session.
 */
import { existsSync } from 'node:fs';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { runLint } from '../../../lib/lint.js';
import { lintStateFile, readLintState, writeLintState } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  // Recursion guard: if the host spawned a nested `claude -p`, KB_BUILDER_INTERNAL=1
  // is set on the child and we must not re-enter the lint tick.
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('claude:kb-lint-tick', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const stateFile = lintStateFile(paths.stateDir);
    const state = readLintState(stateFile);
    const threshold = settings.lintEveryNSessions;
    const nextCount = state.sessions_since_last_lint + 1;

    if (nextCount < threshold) {
      writeLintState(stateFile, { ...state, sessions_since_last_lint: nextCount });
      return;
    }

    process.stderr.write('🔍 KB Lint: Running knowledge base lint…\n');
    const result = runLint({ nodesDir: paths.nodesDir });
    writeLintState(stateFile, {
      schema_version: 1,
      sessions_since_last_lint: 0,
      last_lint_at: new Date().toISOString(),
      last_errors: result.errors.length,
      last_findings: result.findings.length,
    });
    process.stderr.write('🧹 KB Lint: Knowledge base lint complete.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} lint tick error: ${err instanceof Error ? err.message : String(err)}\n`
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
    appendHookDiagnostic('claude:kb-lint-tick', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
