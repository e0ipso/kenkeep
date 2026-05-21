/**
 * sessionEnd hook for the Cursor adapter (lint tick).
 *
 * Increments a session counter on every fire; runs lint every N sessions.
 */
import { existsSync } from 'node:fs';
import { appendHookDiagnostic } from '../../../lib/hook-diagnostic.js';
import { runLint } from '../../../lib/lint.js';
import { lintStateFile, readLintState, writeLintState } from '../../../lib/lint-state.js';
import { findRepoRoot, repoPaths } from '../../../lib/paths.js';
import { resolveSettings } from '../../../lib/settings.js';

const PACKAGE_TAG = '[ai-knowledge-base]';

async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { workspace_roots?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { workspace_roots?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('cursor:kb-lint-tick', 'parse', err, paths.logsDir);
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
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const stateFile = lintStateFile(paths.stateDir);
    const state = readLintState(stateFile);
    const threshold = settings.lintEveryNSessions;
    const nextCount = state.sessions_since_last_lint + 1;

    if (nextCount < threshold) {
      writeLintState(stateFile, { ...state, sessions_since_last_lint: nextCount });
      return;
    }

    const result = runLint({ nodesDir: paths.nodesDir });
    writeLintState(stateFile, {
      schema_version: 1,
      sessions_since_last_lint: 0,
      last_lint_at: new Date().toISOString(),
      last_errors: result.errors.length,
      last_findings: result.findings.length,
    });
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
    appendHookDiagnostic('cursor:kb-lint-tick', 'uncaught', err, paths.logsDir);
  } catch {
    // Outside any project / cannot resolve paths — nothing to log to.
  }
  process.exit(0);
});
