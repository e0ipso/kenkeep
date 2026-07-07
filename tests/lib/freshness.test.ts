import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeFreshness } from '../../src/lib/freshness.js';

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function writeFile(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

function commit(root: string, rel: string, content: string, msg: string): void {
  writeFile(root, rel, content);
  git(root, ['add', '--', rel]);
  git(root, ['commit', '-q', '-m', msg]);
}

interface NodeOpts {
  body?: string;
  derivedFrom?: string[];
  branch?: string;
}

function nodeMarkdown(id: string, opts: NodeOpts): string {
  const fm = {
    kk_schema_version: 3,
    kk_id: id,
    title: id,
    type: 'practice',
    description: 's',
    tags: [],
    kk_derived_from: opts.derivedFrom ?? [],
    kk_relates_to: [],
    kk_confidence: 'high',
  };
  return matter.stringify(opts.body ?? '# x\nBody.', fm);
}

function nodeRel(id: string, branch = 'topic'): string {
  return `.ai/kenkeep/nodes/${branch}/${id}.md`;
}

function commitNode(root: string, id: string, opts: NodeOpts = {}): void {
  const rel = nodeRel(id, opts.branch);
  commit(root, rel, nodeMarkdown(id, opts), `add ${id}`);
}

describe('computeFreshness', () => {
  let root: string;
  let nodesDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-fresh-'));
    nodesDir = join(root, '.ai/kenkeep/nodes');
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'test@example.com']);
    git(root, ['config', 'user.name', 'Test']);
    git(root, ['config', 'commit.gpgsign', 'false']);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('flags a node whose referenced source changed after the node was committed', () => {
    commit(root, 'src/foo.ts', 'v1', 'foo v1');
    commitNode(root, 'practice-a', { body: 'Describes `src/foo.ts` behavior.' });
    commit(root, 'src/foo.ts', 'v2', 'foo v2'); // change after the node

    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(true);
    expect(report.flaggedCount).toBe(1);
    expect(report.flagged[0]?.id).toBe('practice-a');
    expect(report.flagged[0]?.changedPaths).toEqual(['src/foo.ts']);
    expect(report.perBranch).toEqual([{ branch: 'topic', flagged: 1 }]);
  });

  it('does not flag a node whose referenced source changed only before the node', () => {
    commit(root, 'src/bar.ts', 'v1', 'bar v1');
    commit(root, 'src/bar.ts', 'v2', 'bar v2');
    commitNode(root, 'practice-b', { body: 'Describes `src/bar.ts`.' }); // node is newest

    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(true);
    expect(report.flaggedCount).toBe(0);
  });

  it('flags via a tracked kk_derived_from source path that changed after the node', () => {
    commit(root, 'src/baz.ts', 'v1', 'baz v1');
    commitNode(root, 'practice-c', { derivedFrom: ['src/baz.ts'] });
    commit(root, 'src/baz.ts', 'v2', 'baz v2');

    const report = computeFreshness({ root, nodesDir });
    expect(report.flaggedCount).toBe(1);
    expect(report.flagged[0]?.id).toBe('practice-c');
  });

  it('ignores URL, session-log, and untracked references', () => {
    commit(root, 'src/real.ts', 'v1', 'real v1');
    commitNode(root, 'practice-d', {
      body: 'See https://example.com/x and `_sessions/abc.md` and `src/missing.ts`.',
      derivedFrom: ['https://example.com/x', '2026-01-01-abc.md'],
    });
    commit(root, 'src/real.ts', 'v2', 'real v2'); // real.ts changed but node never references it

    const report = computeFreshness({ root, nodesDir });
    expect(report.flaggedCount).toBe(0);
  });

  it('does not flag when the only changed reference is another knowledge-base node', () => {
    commit(root, 'src/x.ts', 'v1', 'x v1');
    commitNode(root, 'practice-e', {
      body: 'Relates to [other](.ai/kenkeep/nodes/topic/practice-other.md).',
    });
    // Change the referenced KB node after practice-e; KB paths are excluded.
    commit(root, '.ai/kenkeep/nodes/topic/practice-other.md', 'changed', 'touch other');

    const report = computeFreshness({ root, nodesDir });
    expect(report.flaggedCount).toBe(0);
  });

  it('does not flag a brand-new uncommitted node', () => {
    commit(root, 'src/foo.ts', 'v1', 'foo v1');
    commit(root, 'src/foo.ts', 'v2', 'foo v2');
    // Write (but never commit) a node referencing foo.ts.
    writeFile(
      root,
      nodeRel('practice-uncommitted'),
      nodeMarkdown('practice-uncommitted', {
        body: 'Describes `src/foo.ts`.',
      })
    );

    const report = computeFreshness({ root, nodesDir });
    expect(report.flaggedCount).toBe(0);
  });

  it('returns an unavailable, empty report on a non-git tree without throwing', () => {
    const plain = mkdtempSync(join(tmpdir(), 'kk-nogit-'));
    try {
      mkdirSync(join(plain, '.ai/kenkeep/nodes/topic'), { recursive: true });
      writeFileSync(
        join(plain, '.ai/kenkeep/nodes/topic/practice-z.md'),
        nodeMarkdown('practice-z', { body: 'Describes `src/foo.ts`.' })
      );
      const report = computeFreshness({ root: plain, nodesDir: join(plain, '.ai/kenkeep/nodes') });
      expect(report.available).toBe(false);
      expect(report.flaggedCount).toBe(0);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  it('returns an empty report for an empty knowledge base', () => {
    commit(root, 'src/foo.ts', 'v1', 'foo v1');
    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(false);
    expect(report.flaggedCount).toBe(0);
  });
});
