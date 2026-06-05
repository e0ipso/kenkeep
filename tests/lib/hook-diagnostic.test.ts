import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendHookDiagnostic } from '../../src/lib/hook-diagnostic.js';

// The happy path (writes one valid JSON line to hook-errors-<date>.log) is
// covered end-to-end by the kk-capture hook integration test. The behavior
// with no integration probe is the resilience contract: a diagnostic-logging
// failure must never throw, because that would crash the host hook.
describe('appendHookDiagnostic (resilience)', () => {
  let logsDir: string;
  beforeEach(() => {
    logsDir = mkdtempSync(join(tmpdir(), 'hook-diag-'));
  });
  afterEach(() => {
    rmSync(logsDir, { recursive: true, force: true });
  });

  it('does not throw when the logs directory cannot be created', () => {
    // Create a regular file, then point the function at a path whose parent
    // is that file, so mkdirSync(recursive) fails because an ancestor is
    // not a directory. This is portable across platforms and CI as root.
    const blocker = join(logsDir, 'not-a-dir');
    writeFileSync(blocker, 'x');
    expect(() =>
      appendHookDiagnostic('test:hook', 'parse', new Error('x'), join(blocker, 'sub'))
    ).not.toThrow();
  });
});
