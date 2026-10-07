import { execFile } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWriteFile, copyMissingEntries } from '../../src/lib/fs-atomic.js';

const execFileAsync = promisify(execFile);
const FS_ATOMIC_SRC = resolve(__dirname, '../../src/lib/fs-atomic.ts');

/**
 * Writes the real helper as plain ESM under `dir` and returns its path. The
 * writer processes run bare Node, and not every supported Node 22 release
 * can import a `.ts` file. The helper only imports `node:` builtins at runtime.
 */
function emitFsAtomicModule(dir: string): string {
  const { outputText } = ts.transpileModule(readFileSync(FS_ATOMIC_SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const file = join(dir, 'fs-atomic.mjs');
  writeFileSync(file, outputText);
  return file;
}

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
    const helper = emitFsAtomicModule(dir);
    const script = [
      `const { atomicWriteFile } = await import(${JSON.stringify(helper)});`,
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

describe('copyMissingEntries (never overwrites)', () => {
  let dir: string;
  let src: string;
  let dest: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-fs-copy-'));
    src = join(dir, 'src');
    dest = join(dir, 'dest');
    mkdirSync(src);
    writeFileSync(join(src, 'a'), 'template');
    mkdirSync(join(src, 'sub'));
    writeFileSync(join(src, 'sub', 'b'), 'template b');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('copies missing files and directories', () => {
    expect(copyMissingEntries(src, dest).sort()).toEqual(['a', 'sub']);
    expect(readFileSync(join(dest, 'a'), 'utf8')).toBe('template');
    expect(readFileSync(join(dest, 'sub', 'b'), 'utf8')).toBe('template b');
  });

  it('keeps an existing dangling symlink instead of replacing it', () => {
    // existsSync follows links, so a link whose target is absent looks missing.
    mkdirSync(dest);
    const target = join(dir, 'user-owned');
    symlinkSync(target, join(dest, 'a'));
    symlinkSync(join(dir, 'user-owned-dir'), join(dest, 'sub'));

    expect(copyMissingEntries(src, dest)).toEqual([]);

    expect(lstatSync(join(dest, 'a')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(dest, 'a'))).toBe(target);
    expect(lstatSync(join(dest, 'sub')).isSymbolicLink()).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(['dest', 'src']);
  });
});
