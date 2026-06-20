import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyRead, reconcileUsage, type ClassifiedRead } from '../../src/lib/usage.js';
import { extractClaudeReads } from '../../src/harnesses/read-extract.js';
import { UsageRecordSchema } from '../../src/lib/schemas.js';

describe('classifyRead', () => {
  let root: string;
  let kkDir: string;
  let nodesDir: string;
  let leaf: string;
  let branchIndex: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-usage-classify-'));
    kkDir = join(root, '.ai', 'kenkeep');
    nodesDir = join(kkDir, 'nodes');
    mkdirSync(join(nodesDir, 'topic', 'sub'), { recursive: true });
    leaf = join(nodesDir, 'topic', 'sub', 'practice-foo.md');
    branchIndex = join(nodesDir, 'topic', 'sub', 'index.md');
    writeFileSync(leaf, '# foo\n');
    writeFileSync(branchIndex, '# index\n');
    mkdirSync(join(root, 'outside'), { recursive: true });
    writeFileSync(join(root, 'outside', 'README.md'), '# r\n');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('names a leaf node by its id', () => {
    expect(classifyRead(leaf, nodesDir, kkDir)).toEqual({ document: 'practice-foo', type: 'leaf' });
  });

  it('names a branch index by its kk-relative POSIX path', () => {
    expect(classifyRead(branchIndex, nodesDir, kkDir)).toEqual({
      document: 'nodes/topic/sub/index.md',
      type: 'index',
    });
  });

  it('returns null for a read outside the node tree', () => {
    expect(classifyRead(join(root, 'outside', 'README.md'), nodesDir, kkDir)).toBeNull();
  });

  it('returns null for a relative path that does not resolve under nodes/', () => {
    expect(classifyRead('some/relative/file.md', nodesDir, kkDir)).toBeNull();
  });

  it('resolves a repo-relative .ai/kenkeep/nodes/... candidate from the kk root', () => {
    expect(classifyRead('.ai/kenkeep/nodes/topic/sub/practice-foo.md', nodesDir, kkDir)).toEqual({
      document: 'practice-foo',
      type: 'leaf',
    });
    expect(classifyRead('.ai/kenkeep/nodes/topic/sub/index.md', nodesDir, kkDir)).toEqual({
      document: 'nodes/topic/sub/index.md',
      type: 'index',
    });
  });

  it('resolves a kk-root-relative nodes/... candidate from kkDir', () => {
    expect(classifyRead('nodes/topic/sub/practice-foo.md', nodesDir, kkDir)).toEqual({
      document: 'practice-foo',
      type: 'leaf',
    });
  });

  it('ignores a non-node markdown candidate even in the supported relative forms', () => {
    expect(classifyRead('nodes/../../README.md', nodesDir, kkDir)).toBeNull();
    expect(classifyRead('README.md', nodesDir, kkDir)).toBeNull();
  });
});

describe('reconcileUsage (monotonic, session-keyed)', () => {
  let root: string;
  let usageFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-usage-reconcile-'));
    usageFile = join(root, '.state', 'usage.jsonl');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function lines(): string[] {
    return existsSync(usageFile)
      ? readFileSync(usageFile, 'utf8')
          .split('\n')
          .filter(line => line.trim().length > 0)
      : [];
  }

  const leafReads = (docs: string[]): ClassifiedRead[] =>
    docs.map(document => ({ document, type: 'leaf' }));

  it('writes one line per occurrence, stays idempotent, and never decreases', async () => {
    const sid = 'session-1';
    await reconcileUsage(usageFile, sid, '2026-06-11T00:00:00Z', leafReads(['a', 'a', 'b']));
    expect(lines().length).toBe(3);

    // Re-capture with the same cumulative reads: no new lines.
    await reconcileUsage(usageFile, sid, '2026-06-11T00:01:00Z', leafReads(['a', 'a', 'b']));
    expect(lines().length).toBe(3);

    // One additional read of `a`: exactly one line appended.
    await reconcileUsage(usageFile, sid, '2026-06-11T00:02:00Z', leafReads(['a', 'a', 'a', 'b']));
    expect(lines().length).toBe(4);

    // Post-compaction truncation shows fewer reads: nothing is removed.
    await reconcileUsage(usageFile, sid, '2026-06-11T00:03:00Z', leafReads(['a']));
    expect(lines().length).toBe(4);

    for (const line of lines()) {
      expect(UsageRecordSchema.safeParse(JSON.parse(line)).success).toBe(true);
    }
  });

  it('keys counts by session id so different sessions accumulate independently', async () => {
    await reconcileUsage(usageFile, 's1', 't', leafReads(['x']));
    await reconcileUsage(usageFile, 's2', 't', leafReads(['x']));
    expect(lines().length).toBe(2);
  });
});

describe('extract + classify integration', () => {
  let root: string;
  let kkDir: string;
  let nodesDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'kk-usage-e2e-'));
    kkDir = join(root, '.ai', 'kenkeep');
    nodesDir = join(kkDir, 'nodes');
    mkdirSync(join(nodesDir, 'topic'), { recursive: true });
    writeFileSync(join(nodesDir, 'topic', 'practice-foo.md'), '# foo\n');
    writeFileSync(join(nodesDir, 'topic', 'index.md'), '# index\n');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('classifies a transcript read of a leaf and a branch index into two records', () => {
    const leafAbs = join(nodesDir, 'topic', 'practice-foo.md');
    const indexAbs = join(nodesDir, 'topic', 'index.md');
    const text = [
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read', input: { file_path: leafAbs } }],
        },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read', input: { file_path: indexAbs } }],
        },
      }),
    ].join('\n');

    const classified = extractClaudeReads(text)
      .map(p => classifyRead(p, nodesDir, kkDir))
      .filter((r): r is ClassifiedRead => r !== null);

    expect(classified).toEqual([
      { document: 'practice-foo', type: 'leaf' },
      { document: 'nodes/topic/index.md', type: 'index' },
    ]);
  });
});
