import { execFile } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFolderSummaries } from '../../src/lib/folder-summaries.js';
import { readAllNodes } from '../../src/lib/nodes.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const exec = promisify(execFile);

function nodesDir(root: string): string {
  return join(root, '.ai/kenkeep/nodes');
}

function writeV2Node(
  root: string,
  relDir: string,
  kind: 'practice' | 'map',
  id: string,
  overrides: Record<string, unknown> = {}
): void {
  const dir = join(nodesDir(root), relDir);
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 2,
    id,
    title: id,
    kind,
    summary: `summary for ${id}`,
    tags: ['legacy'],
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    ...overrides,
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(`# ${id}\n\nBody prose.\n`, fm));
}

/** Every file under `.ai/kenkeep/` as relPath -> bytes, for zero-write assertions. */
function treeBytes(root: string): Record<string, string> {
  const kkDir = join(root, '.ai/kenkeep');
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) out[relative(kkDir, full)] = `-> ${readlinkSync(full)}`;
      else if (entry.isDirectory()) walk(full);
      else out[relative(kkDir, full)] = readFileSync(full, 'utf8');
    }
  };
  walk(kkDir);
  return out;
}

function writeV2Index(root: string, relDir: string, summary: string): void {
  const dir = relDir === '' ? nodesDir(root) : join(nodesDir(root), relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.md'),
    matter.stringify('# Legacy index\n', {
      schema_version: 2,
      nodes_hash: 'sha256:legacy',
      node_count: 1,
      summary,
    })
  );
}

describe('migrate okf-v3', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox('kk-okf-v3-');
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
    rmSync(nodesDir(sandbox), { recursive: true, force: true });
    mkdirSync(nodesDir(sandbox), { recursive: true });
  });

  afterEach(() => cleanSandbox(sandbox));

  it('preserves summaries longer than the former 140-character cap', async () => {
    const longSummary =
      'This summary deliberately exceeds one hundred forty characters so the migration proves it can copy v2 summary text verbatim without truncation or LLM summarization.';
    writeV2Node(sandbox, 'long', 'practice', 'practice-long-summary', { summary: longSummary });

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(0);

    const parsed = matter(
      readFileSync(join(nodesDir(sandbox), 'long', 'practice-long-summary.md'), 'utf8')
    );
    expect(parsed.data.description).toBe(longSummary);
    expect((parsed.data.description as string).length).toBeGreaterThan(140);
  });

  it('mechanically rewrites v2 leaves to v3, migrates summaries, and rebuilds OKF indexes', async () => {
    writeV2Node(sandbox, 'workflow', 'map', 'map-target');
    writeV2Node(sandbox, 'workflow', 'practice', 'practice-source', {
      derived_from: ['session-1.md'],
      relates_to: ['map-target'],
      depends_on: ['map-target'],
    });
    writeV2Index(sandbox, '', 'root legacy summary');
    writeV2Index(sandbox, 'workflow', 'workflow legacy summary');

    const status = await runCli(sandbox, ['migrate', 'status']);
    expect(JSON.parse(status.stdout.trim()).steps).toEqual([
      { id: 'okf-v3', from: 2, to: 3, primitives: ['migrate okf-v3'] },
    ]);

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim());
    expect(summary.converted).toBe(2);

    const sourcePath = join(nodesDir(sandbox), 'workflow', 'practice-source.md');
    const parsed = matter(readFileSync(sourcePath, 'utf8'));
    expect(parsed.data).toMatchObject({
      kk_schema_version: 3,
      kk_id: 'practice-source',
      type: 'practice',
      description: 'summary for practice-source',
      kk_derived_from: ['session-1.md'],
      kk_relates_to: ['map-target'],
      kk_depends_on: ['map-target'],
      kk_confidence: 'high',
    });
    expect(parsed.data.schema_version).toBeUndefined();
    expect(parsed.data.kind).toBeUndefined();
    expect(parsed.data.summary).toBeUndefined();
    expect(parsed.content).toContain('Body prose.');
    expect(parsed.content).toContain('- Related: [map-target](map-target.md)');
    expect(parsed.content).toContain('- Depends on: [map-target](map-target.md)');
    expect(parsed.content).toContain('[1] [session-1.md](../../../../session-1.md)');

    const summaries = readFolderSummaries(nodesDir(sandbox));
    expect(summaries.get('')).toBe('root legacy summary');
    expect(summaries.get('workflow')).toBe('workflow legacy summary');

    expect(matter(readFileSync(join(nodesDir(sandbox), 'index.md'), 'utf8')).data).toEqual({
      okf_version: '0.1',
    });
    expect(
      matter(readFileSync(join(nodesDir(sandbox), 'workflow', 'index.md'), 'utf8')).data
    ).toEqual({});
    expect(existsSync(join(sandbox, '.ai/kenkeep/ENTRY.md'))).toBe(true);
    expect(existsSync(join(sandbox, '.ai/kenkeep/GRAPH.md'))).toBe(true);
  });

  it('rejects two leaves sharing an id before any write', async () => {
    writeV2Node(sandbox, 'x', 'practice', 'practice-twin');
    writeV2Node(sandbox, 'y', 'practice', 'practice-twin');
    writeV2Node(sandbox, 'z', 'map', 'map-other');
    writeV2Index(sandbox, 'x', 'x legacy summary');
    const before = treeBytes(sandbox);

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toMatch(/practice-twin/);
    expect(result.stderr).toMatch(/x\/practice-twin\.md/);
    expect(result.stderr).toMatch(/y\/practice-twin\.md/);
    expect(result.stderr).toMatch(/more than one leaf/);

    // Zero writes: leaves, indexes and the (absent) sidecar are untouched.
    expect(treeBytes(sandbox)).toEqual(before);
    expect(existsSync(join(sandbox, '.ai/kenkeep/FOLDER_SUMMARIES.md'))).toBe(false);
  });

  // A read-only folder injects a real EACCES on the leaf rewrite, which the
  // preflight cannot rule out. Root ignores directory modes.
  it.skipIf(process.getuid?.() === 0)(
    'resumes to completion after an I/O failure left a mixed tree',
    async () => {
      writeV2Node(sandbox, 'a', 'practice', 'practice-first', { relates_to: ['map-second'] });
      writeV2Node(sandbox, 'b', 'map', 'map-second', {
        derived_from: ['session-2.md'],
        depends_on: ['practice-first'],
      });
      writeV2Index(sandbox, 'a', 'a legacy summary');
      const lockedDir = join(nodesDir(sandbox), 'b');
      chmodSync(lockedDir, 0o555);

      let failed;
      try {
        failed = await runCli(sandbox, ['migrate', 'okf-v3']);
      } finally {
        chmodSync(lockedDir, 0o755);
      }
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout.trim()).toBe('');
      expect(failed.stderr).toMatch(/EACCES|permission denied/i);
      expect(failed.stderr).toMatch(/b\/map-second\.md/);
      expect(failed.stderr).toMatch(/re-run/i);

      // Mixed tree on disk: `a` is v3, `b` is still v2.
      expect(
        matter(readFileSync(join(nodesDir(sandbox), 'a', 'practice-first.md'), 'utf8')).data
      ).toMatchObject({ kk_schema_version: 3, kk_id: 'practice-first' });
      expect(matter(readFileSync(join(lockedDir, 'map-second.md'), 'utf8')).data).toMatchObject({
        schema_version: 2,
        id: 'map-second',
      });
      expect(() => readAllNodes(nodesDir(sandbox))).toThrow(/kk-migrate/);

      const resumed = await runCli(sandbox, ['migrate', 'okf-v3']);
      expect(resumed.exitCode).toBe(0);
      const summary = JSON.parse(resumed.stdout.trim());
      expect(summary).toMatchObject({ converted: 1, already_converted: 1 });
      const second = matter(readFileSync(join(lockedDir, 'map-second.md'), 'utf8'));
      expect(second.data).toMatchObject({
        kk_schema_version: 3,
        kk_id: 'map-second',
        kk_derived_from: ['session-2.md'],
        kk_depends_on: ['practice-first'],
      });
      expect(second.content).toContain('- Depends on: [practice-first](../a/practice-first.md)');
      expect(readAllNodes(nodesDir(sandbox))).toHaveLength(2);
      expect(readFolderSummaries(nodesDir(sandbox)).get('a')).toBe('a legacy summary');
    }
  );
  // Every leaf is v3 after these failures, and no artifact on disk proves the
  // outputs were finished: the shipped ENTRY.md template is already v3, and
  // the folder indexes may all have converted before the graph write failed.
  // The re-run must still complete every output. Root ignores directory modes.
  const v2Entry = matter.stringify('# Legacy entry\n', {
    schema_version: 2,
    nodes_hash: 'sha256:legacy',
  });
  const staleV3Entry = matter.stringify('# Stale catalog\n', {
    schema_version: 3,
    node_count: 0,
    nodes_hash: 'stale',
  });
  it.skipIf(process.getuid?.() === 0).each([
    ['the first index write fails under a v2 entry catalog', 'index', v2Entry],
    ['the first index write fails under a stale v3 entry catalog', 'index', staleV3Entry],
    ['the graph write fails after every index converted', 'graph', null],
  ])('resumes after the final leaf converted when %s', async (_label, failure, entry) => {
    writeV2Node(sandbox, 'topic', 'practice', 'practice-one');
    writeV2Index(sandbox, '', 'root legacy summary');
    writeV2Index(sandbox, 'topic', 'topic legacy summary');
    const entryFile = join(sandbox, '.ai/kenkeep/ENTRY.md');
    const graphFile = join(sandbox, '.ai/kenkeep/GRAPH.md');
    // Without an override the entry catalog stays the v3 template init wrote.
    if (entry !== null) writeFileSync(entryFile, entry);
    else expect(matter(readFileSync(entryFile, 'utf8')).data.schema_version).toBe(3);
    const leaf = join(nodesDir(sandbox), 'topic', 'practice-one.md');

    let failed;
    if (failure === 'index') {
      chmodSync(nodesDir(sandbox), 0o555);
      try {
        failed = await runCli(sandbox, ['migrate', 'okf-v3']);
      } finally {
        chmodSync(nodesDir(sandbox), 0o755);
      }
      expect(failed.stderr).toMatch(/EACCES|permission denied/i);
    } else {
      rmSync(graphFile, { force: true });
      mkdirSync(graphFile);
      failed = await runCli(sandbox, ['migrate', 'okf-v3']);
      rmSync(graphFile, { recursive: true });
      expect(failed.stderr).toMatch(/EISDIR|illegal operation on a directory/i);
      for (const dir of ['', 'topic']) {
        const index = join(nodesDir(sandbox), dir, 'index.md');
        expect(matter(readFileSync(index, 'utf8')).data.schema_version).toBeUndefined();
      }
    }
    expect(failed.exitCode).toBe(1);
    expect(failed.stderr).toMatch(/re-run/i);
    const converted = readFileSync(leaf, 'utf8');
    expect(matter(converted).data).toMatchObject({ kk_schema_version: 3 });

    const resumed = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(resumed.stderr).toBe('');
    expect(resumed.exitCode).toBe(0);
    expect(JSON.parse(resumed.stdout.trim())).toMatchObject({
      converted: 0,
      already_converted: 1,
    });
    expect(readFileSync(leaf, 'utf8')).toBe(converted);
    const catalog = matter(readFileSync(entryFile, 'utf8'));
    expect(catalog.data).toMatchObject({ schema_version: 3, node_count: 1 });
    expect(catalog.content).not.toMatch(/Legacy entry|Stale catalog/);
    expect(readFileSync(graphFile, 'utf8')).toContain('practice-one');
    expect(matter(readFileSync(join(nodesDir(sandbox), 'topic', 'index.md'), 'utf8')).data).toEqual(
      {}
    );
    expect(readFolderSummaries(nodesDir(sandbox)).get('topic')).toBe('topic legacy summary');
    expect(() => readAllNodes(nodesDir(sandbox))).not.toThrow();

    // Finished: another run converts nothing and rewrites the same bytes.
    const before = treeBytes(sandbox);
    const again = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(again.exitCode).toBe(0);
    expect(JSON.parse(again.stdout.trim())).toMatchObject({ converted: 0 });
    expect(treeBytes(sandbox)).toEqual(before);
  });

  it('refuses a tree at a schema version other than 2 or 3', async () => {
    writeV2Node(sandbox, 'topic', 'practice', 'practice-one', { schema_version: 1 });
    const before = treeBytes(sandbox);
    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(
      /expected schema_version 2 \(or 3 to finish an interrupted run\), detected 1/
    );
    expect(treeBytes(sandbox)).toEqual(before);
  });

  // Every output the run writes goes through the containment check before the
  // first leaf converts, so a user-owned link there is never replaced.
  it.each([
    ['ENTRY.md', 'ENTRY.md', false],
    ['ENTRY.md (dangling)', 'ENTRY.md', true],
    ['GRAPH.md', 'GRAPH.md', false],
    ['GRAPH.md (dangling)', 'GRAPH.md', true],
    ['FOLDER_SUMMARIES.md', 'FOLDER_SUMMARIES.md', false],
    ['FOLDER_SUMMARIES.md (dangling)', 'FOLDER_SUMMARIES.md', true],
    ['a folder index.md (dangling)', 'nodes/topic/index.md', true],
  ])('refuses a symlink at %s before any write', async (_label, relLink, dangling) => {
    writeV2Node(sandbox, 'topic', 'practice', 'practice-one');
    const link = join(sandbox, '.ai/kenkeep', relLink);
    const outside = join(sandbox, 'user-catalog.md');
    if (!dangling)
      writeFileSync(outside, matter.stringify('# User catalog\n', { schema_version: 2 }));
    rmSync(link, { force: true });
    symlinkSync(outside, link);
    const before = treeBytes(sandbox);

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toMatch(/crosses the symlink/);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(outside)).toBe(!dangling);
    expect(treeBytes(sandbox)).toEqual(before);
  });

  it('refuses a symlinked v2 leaf before any write and keeps the link', async () => {
    writeV2Node(sandbox, 'topic', 'practice', 'practice-plain');
    writeV2Node(sandbox, 'topic', 'practice', 'practice-linked');
    const link = join(nodesDir(sandbox), 'topic', 'practice-linked.md');
    const outside = join(sandbox, 'outside.md');
    writeFileSync(outside, readFileSync(link));
    rmSync(link);
    symlinkSync(outside, link);
    const outsideBytes = readFileSync(outside, 'utf8');
    const before = treeBytes(sandbox);

    const result = await runCli(sandbox, ['migrate', 'okf-v3']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toMatch(/crosses the symlink/);

    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readFileSync(outside, 'utf8')).toBe(outsideBytes);
    expect(treeBytes(sandbox)).toEqual(before);
  });
});
