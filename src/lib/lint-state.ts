import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';
import { runLint } from './lint.js';
import { findRepoRoot, repoPaths } from './paths.js';
import { LintStateFileSchema, type LintStateFile } from './schemas.js';
import { resolveSettings } from './settings.js';

export const DEFAULT_LINT_STATE: LintStateFile = {
  schema_version: 1,
  sessions_since_last_lint: 0,
  last_lint_at: null,
  last_errors: 0,
  last_findings: 0,
};

export function lintStateFile(stateDir: string): string {
  return join(stateDir, 'lint-state.json');
}

export function readLintState(file: string): LintStateFile {
  return readJsonValidated(file, LintStateFileSchema, { ...DEFAULT_LINT_STATE });
}

export function writeLintState(file: string, state: LintStateFile): void {
  atomicWriteJson(file, state);
}

export async function runLintTick(startCwd: string, harnessTag: string): Promise<void> {
  const PACKAGE_TAG = '[ai-knowledge-base]';
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
      `${PACKAGE_TAG} lint tick error (${harnessTag}): ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}
