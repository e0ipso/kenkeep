import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  folderSummariesFileForNodesDir,
  readFolderSummaries,
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
});
