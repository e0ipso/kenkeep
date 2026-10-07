import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWriteFile } from '../../src/lib/fs-atomic.js';

const execFileAsync = promisify(execFile);
const FS_ATOMIC_SRC = resolve(__dirname, '../../src/lib/fs-atomic.ts');

// Every state writer funnels through one unique-temp atomic writer.
// Simultaneous hook processes (e.g. several SessionStart events) used to share
// a fixed `<file>.tmp`, so one process's rename stole another's temp file and
// the loser threw ENOENT. These tests drive the real collision shape: separate
// OS processes racing on the same destination.
describe('atomicWriteFile (unique temp, always cleaned up)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-fs-atomic-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('survives 50 concurrent writer processes on one destination with a complete final file', async () => {
    const dest = join(dir, 'state', 'state.json');
    const writers = 50;
    // Each writer's payload is large enough that the write is not instantaneous
    // and is uniquely identifiable, so a torn or interleaved file is detectable.
    const payloadFor = (i: number): string =>
      `${String(i).padStart(3, '0')}:${'x'.repeat(256 * 1024)}\n`;
    const script = [
      `const { atomicWriteFile } = await import(${JSON.stringify(FS_ATOMIC_SRC)});`,
      `const i = Number(process.argv[1]);`,
      `const body = String(i).padStart(3, '0') + ':' + 'x'.repeat(256 * 1024) + '\\n';`,
      // Half the writers pass a Buffer to exercise both accepted input types.
      `atomicWriteFile(${JSON.stringify(dest)}, i % 2 === 0 ? body : Buffer.from(body));`,
    ].join('\n');

    const results = await Promise.allSettled(
      Array.from({ length: writers }, (_, i) =>
        execFileAsync(process.execPath, [
          '--no-warnings',
          '--input-type=module',
          '-e',
          script,
          String(i),
        ])
      )
    );

    const failures = results.flatMap(r =>
      r.status === 'rejected' ? [String((r.reason as { stderr?: string }).stderr ?? r.reason)] : []
    );
    expect(failures).toEqual([]);

    const final = readFileSync(dest, 'utf8');
    const winner = Number(final.slice(0, 3));
    expect(Number.isInteger(winner)).toBe(true);
    expect(final).toBe(payloadFor(winner));
    expect(readdirSync(join(dir, 'state'))).toEqual(['state.json']);
  }, 60_000);

  it('removes its temp file and leaves the destination intact when the write fails', () => {
    // Renaming a file over a non-empty directory fails after the temp file has
    // been fully written: the worst point for a leak.
    const dest = join(dir, 'blocked');
    mkdirSync(dest);
    writeFileSync(join(dest, 'keep.txt'), 'untouched');

    expect(() => atomicWriteFile(dest, 'new contents')).toThrow();

    expect(readdirSync(dir)).toEqual(['blocked']);
    expect(readFileSync(join(dest, 'keep.txt'), 'utf8')).toBe('untouched');
  });
});
