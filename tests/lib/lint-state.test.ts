import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LINT_STATE, lintStateFile, readLintState } from '../../src/lib/lint-state.js';

// The default-when-missing read and the valid round-trip are exercised
// end-to-end by the kk-lint-tick hook integration test. The behavior with no
// integration probe is the defensive fallback: malformed or schema-violating
// state on disk must degrade to defaults rather than crash a hook.
describe('readLintState (defensive fallback)', () => {
  let root: string;
  let file: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-lint-state-'));
    const stateDir = join(root, '.state');
    mkdirSync(stateDir, { recursive: true });
    file = lintStateFile(stateDir);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('falls back to defaults for malformed JSON and schema-failing input', () => {
    writeFileSync(file, '{not json');
    expect(readLintState(file)).toEqual(DEFAULT_LINT_STATE);

    // Negative counter violates the schema (must be a non-negative integer).
    writeFileSync(file, JSON.stringify({ schema_version: 1, sessions_since_last_lint: -3 }));
    expect(readLintState(file)).toEqual(DEFAULT_LINT_STATE);
  });
});
