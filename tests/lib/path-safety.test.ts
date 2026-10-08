import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertContained, normalizeFolderKey } from '../../src/lib/path-safety.js';

describe('path-safety: folder keys', () => {
  it('normalizes equivalent spellings of a contained folder to one POSIX key', () => {
    expect(normalizeFolderKey('')).toBe('');
    expect(normalizeFolderKey('.')).toBe('');
    expect(normalizeFolderKey('/')).toBe('');
    expect(normalizeFolderKey('./a//b/')).toBe('a/b');
    expect(normalizeFolderKey('a/./b/../c')).toBe('a/c');
    // Topical folders named after kinds are ordinary folders.
    expect(normalizeFolderKey('map')).toBe('map');
    expect(normalizeFolderKey('practice')).toBe('practice');
  });
});

describe('path-safety: containment', () => {
  let root: string;
  let outside: string;
  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'kk-path-safety-'));
    root = join(base, 'nodes');
    outside = join(base, 'outside');
    mkdirSync(root, { recursive: true });
    mkdirSync(outside, { recursive: true });
  });
  afterEach(() => rmSync(join(root, '..'), { recursive: true, force: true }));

  it('rejects a symlinked leaf file and a symlink that stays inside the root', () => {
    writeFileSync(join(outside, 'secret.md'), 'x');
    symlinkSync(join(outside, 'secret.md'), join(root, 'practice-x.md'));
    expect(() => assertContained(root, join(root, 'practice-x.md'))).toThrow(/symlink/);
    // Even an in-tree symlink is a segment the writer must not follow.
    mkdirSync(join(root, 'a'));
    symlinkSync(join(root, 'a'), join(root, 'b'));
    expect(() => assertContained(root, join(root, 'b', 'leaf.md'))).toThrow(/symlink/);
  });
});
