import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeFreshness } from '../../src/lib/freshness.js';

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function gitOut(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, stdio: 'pipe', maxBuffer: Infinity }).toString().trim();
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

  it('still flags a node after its referenced source is deleted', () => {
    commit(root, 'src/gone.ts', 'v1', 'gone v1');
    commitNode(root, 'practice-del', { body: 'Describes `src/gone.ts`.' });
    commit(root, 'src/gone.ts', 'v2', 'gone v2');
    expect(computeFreshness({ root, nodesDir }).flaggedCount).toBe(1);

    git(root, ['rm', '-q', '--', 'src/gone.ts']);
    git(root, ['commit', '-q', '-m', 'delete gone']);

    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(true);
    expect(report.flagged).toEqual([
      { id: 'practice-del', branch: 'topic', changedPaths: ['src/gone.ts'] },
    ]);
  });

  it('flags a node whose referenced source was renamed away after curation', () => {
    commit(root, 'src/old-name.ts', 'export const a = 1;\n', 'old v1');
    commitNode(root, 'practice-ren', { derivedFrom: ['src/old-name.ts'] });
    git(root, ['mv', 'src/old-name.ts', 'src/new-name.ts']);
    git(root, ['commit', '-q', '-m', 'rename']);

    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(true);
    expect(report.flagged).toEqual([
      { id: 'practice-ren', branch: 'topic', changedPaths: ['src/old-name.ts'] },
    ]);
  });

  it('does not flag a deletion that happened before the node was curated', () => {
    commit(root, 'src/early.ts', 'v1', 'early v1');
    git(root, ['rm', '-q', '--', 'src/early.ts']);
    git(root, ['commit', '-q', '-m', 'delete early']);
    commitNode(root, 'practice-early', { body: 'Used to live in `src/early.ts`.' });

    const report = computeFreshness({ root, nodesDir });
    expect(report.available).toBe(true);
    expect(report.flaggedCount).toBe(0);
  });

  it('completes on a history whose name output exceeds 1 MiB', () => {
    // Bulk commit via fast-import: 24k paths of ~65 bytes (~1.5 MiB of names),
    // then load them into the index so a `git ls-files` listing is just as large.
    const branch = gitOut(root, ['symbolic-ref', 'HEAD']);
    const lines: string[] = ['blob', 'mark :1', 'data 1', 'x'];
    lines.push(
      `commit ${branch}`,
      'committer T <t@example.com> 1700000000 +0000',
      'data 4',
      'bulk'
    );
    lines.push('M 100644 :1 src/foo.ts');
    for (let i = 0; i < 24_000; i += 1) {
      const n = String(i).padStart(5, '0');
      lines.push(
        `M 100644 :1 vendor/generated/group-${n.slice(0, 2)}/library-module-${n}-generated-file.js`
      );
    }
    lines.push('');
    execFileSync('git', ['fast-import', '--quiet'], {
      cwd: root,
      input: lines.join('\n'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    git(root, ['read-tree', 'HEAD']);
    expect(gitOut(root, ['ls-files']).length).toBeGreaterThan(1024 * 1024);

    commitNode(root, 'practice-big', { body: 'Describes `src/foo.ts`.' });
    commit(root, 'src/foo.ts', 'v2', 'foo v2');

    const report = computeFreshness({ root, nodesDir });
    expect(report.reason).toBeUndefined();
    expect(report.available).toBe(true);
    expect(report.flagged.map(f => f.id)).toEqual(['practice-big']);
  });

  it('kills a slow git log at the deadline and reports no signal', () => {
    commitNode(root, 'practice-a', { body: 'Describes `src/foo.ts` behavior.' });
    const realGit = execFileSync('sh', ['-c', 'command -v git']).toString().trim();
    const binDir = join(root, 'slow-bin');
    mkdirSync(binDir);
    writeFileSync(
      join(binDir, 'git'),
      `#!/bin/sh\nif [ "$1" = log ]; then sleep 3; exit 0; fi\nexec ${realGit} "$@"\n`
    );
    chmodSync(join(binDir, 'git'), 0o755);
    const savedPath = process.env['PATH'];
    process.env['PATH'] = `${binDir}:${savedPath ?? ''}`;
    try {
      const started = Date.now();
      const report = computeFreshness({ root, nodesDir, deadlineAt: started + 300 });
      expect(Date.now() - started).toBeLessThan(1500);
      expect(report.available).toBe(false);
      expect(report.reason).toBe('git log did not finish before the hook deadline');
    } finally {
      process.env['PATH'] = savedPath;
    }
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
      expect(report.reason).toMatch(/^git log failed: /);
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
