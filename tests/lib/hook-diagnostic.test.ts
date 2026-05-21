import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendHookDiagnostic } from '../../src/lib/hook-diagnostic.js';

describe('appendHookDiagnostic', () => {
  let logsDir: string;
  beforeEach(() => {
    logsDir = mkdtempSync(join(tmpdir(), 'hook-diag-'));
  });
  afterEach(() => {
    rmSync(logsDir, { recursive: true, force: true });
  });

  it('writes one valid JSON line with expected fields', () => {
    appendHookDiagnostic('test:hook', 'parse', new Error('bad json'), logsDir);

    const dateStr = new Date().toISOString().slice(0, 10);
    const files = readdirSync(logsDir);
    const logFile = files.find(f => f === `hook-errors-${dateStr}.log`);
    expect(logFile).toBeDefined();

    const content = readFileSync(join(logsDir, logFile!), 'utf8');
    const lines = content.split('\n').filter(l => l.length > 0);
    expect(lines).toHaveLength(1);

    const obj = JSON.parse(lines[0]!) as {
      ts: string;
      hook: string;
      phase: string;
      error: string;
    };
    expect(obj).toMatchObject({
      hook: 'test:hook',
      phase: 'parse',
      error: 'bad json',
    });
    expect(new Date(obj.ts).toString()).not.toBe('Invalid Date');
  });

  it('does not throw when logsDir cannot be created', () => {
    // Create a regular file, then point the function at a path whose parent
    // is that file — mkdirSync(recursive) will fail because an ancestor is
    // not a directory. This is portable across platforms and CI as root.
    const blocker = join(logsDir, 'not-a-dir');
    writeFileSync(blocker, 'x');
    expect(() =>
      appendHookDiagnostic('test:hook', 'parse', new Error('x'), join(blocker, 'sub'))
    ).not.toThrow();
  });

  it('wrapper pattern records uncaught throws and does not rethrow', async () => {
    const fakeMain = async (): Promise<void> => {
      throw new Error('synthetic');
    };
    let exitedCleanly = false;
    await fakeMain().catch((err: unknown) => {
      appendHookDiagnostic('test:wrapper', 'uncaught', err, logsDir);
      exitedCleanly = true; // stands in for process.exit(0)
    });
    expect(exitedCleanly).toBe(true);

    const files = readdirSync(logsDir);
    expect(files).toHaveLength(1);
    const content = readFileSync(join(logsDir, files[0]!), 'utf8').trim();
    const obj = JSON.parse(content) as { phase: string; error: string };
    expect(obj.phase).toBe('uncaught');
    expect(obj.error).toBe('synthetic');
  });
});
