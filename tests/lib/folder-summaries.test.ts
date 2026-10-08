import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  folderSummariesFileForNodesDir,
  readFolderSummaries,
  reconcileFolderSummaries,
  setFolderSummary,
  writeFolderSummaries,
} from '../../src/lib/folder-summaries.js';

describe('folder summary sidecar', () => {
  let root: string;
  let nodesDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-folder-summaries-'));
    nodesDir = join(root, 'nodes');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('round-trips summaries through a deterministic committed markdown sidecar', () => {
    const summaries = new Map([
      ['workflow', 'Workflow practices.'],
      ['storage/cache', 'Cache internals'],
    ]);

    writeFolderSummaries(nodesDir, summaries);
    const file = folderSummariesFileForNodesDir(nodesDir);
    expect(existsSync(file)).toBe(true);
    const first = readFileSync(file, 'utf8');
    expect(matter(first).data).toEqual({
      schema_version: 1,
      summaries: {
        'storage/cache': 'Cache internals',
        workflow: 'Workflow practices.',
      },
    });

    expect(readFolderSummaries(nodesDir)).toEqual(
      new Map([
        ['storage/cache', 'Cache internals'],
        ['workflow', 'Workflow practices.'],
      ])
    );

    writeFolderSummaries(nodesDir, readFolderSummaries(nodesDir));
    expect(readFileSync(file, 'utf8')).toBe(first);

    setFolderSummary(nodesDir, 'workflow', 'Workflow practices.');
    expect(readFileSync(file, 'utf8')).toBe(first);
  });

  it('reconciles the registry against the owned folder set: keeps owned keys, prunes the rest', () => {
    // The documented rule: a sidecar entry lives exactly as long as its
    // folder is in the owned set (root plus every folder with a leaf beneath
    // it). The root key always survives; pruned keys are reported sorted so the
    // rebuild can name them.
    const registry = new Map([
      ['', 'Whole tree.'],
      ['kept', 'Kept things.'],
      ['kept/deep', 'Deep things.'],
      ['old', 'Old things.'],
      ['zombie/branch', 'Gone.'],
    ]);
    const owned = new Set(['', 'kept', 'kept/deep']);
    const { kept, pruned } = reconcileFolderSummaries(registry, owned);
    expect([...kept]).toEqual([
      ['', 'Whole tree.'],
      ['kept', 'Kept things.'],
      ['kept/deep', 'Deep things.'],
    ]);
    expect(pruned).toEqual(['old', 'zombie/branch']);
    // The input registry is not mutated.
    expect(registry.size).toBe(5);
  });
});
