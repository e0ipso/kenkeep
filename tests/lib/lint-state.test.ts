import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LINT_STATE,
  lintStateFile,
  readLintState,
  writeLintState,
} from '../../src/lib/lint-state.js';

describe('lint-state read/write', () => {
  let root: string;
  let stateDir: string;
  let file: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kb-lint-state-'));
    stateDir = join(root, '.state');
    mkdirSync(stateDir, { recursive: true });
    file = lintStateFile(stateDir);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('falls back to defaults for missing, malformed, and schema-failing input; round-trips valid state', () => {
    expect(readLintState(file)).toEqual(DEFAULT_LINT_STATE);

    writeFileSync(file, '{not json');
    expect(readLintState(file)).toEqual(DEFAULT_LINT_STATE);

    writeFileSync(file, JSON.stringify({ schema_version: 1, sessions_since_last_lint: -3 }));
    expect(readLintState(file)).toEqual(DEFAULT_LINT_STATE);

    const fresh = {
      schema_version: 1 as const,
      sessions_since_last_lint: 4,
      last_lint_at: '2026-05-13T09:00:00Z',
      last_errors: 2,
      last_findings: 1,
    };
    writeLintState(file, fresh);
    expect(readLintState(file)).toEqual(fresh);
  });
});
