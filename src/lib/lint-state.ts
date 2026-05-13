import { join } from 'node:path';
import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';
import { LintStateFileSchema, type LintStateFile } from './schemas.js';

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
