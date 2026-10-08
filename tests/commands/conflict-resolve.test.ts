import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const TARGET = 'practice-foo';
const ORIGIN = 'sess-1:practice:0';

function sandboxRepo(): string {
  const root = makeSandbox('ai-kk-conflict-resolve-');
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/.state'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/nodes/topic'), { recursive: true });
  mkdirSync(join(root, '.ai/kenkeep/conflicts'), { recursive: true });
  writeFileSync(
    join(root, '.ai/kenkeep/.state/installed-version'),
    JSON.stringify({
      schema_version: 1,
      package: 'kenkeep',
      version: '0.0.0-test',
      installed_at: '2026-05-23T10:00:00Z',
      harnesses: ['claude'],
    })
  );
  return root;
}

function writeLeaf(root: string, relDir: string, id: string, body = 'Old body.\n'): string {
  const dir = join(root, '.ai/kenkeep/nodes', relDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${id}.md`);
  writeFileSync(
    file,
    matter.stringify(body, {
      kk_schema_version: 3,
      kk_id: id,
      title: `Old ${id}`,
      type: 'practice',
      description: 'old summary',
      tags: ['old-tag'],
      kk_derived_from: ['old-session:practice:0'],
      kk_relates_to: [],
      kk_depends_on: [],
      kk_confidence: 'medium',
    })
  );
  return file;
}

function proposal(body = 'New body from the proposal.\n'): Record<string, unknown> {
  return {
    title: 'New title',
    type: 'practice',
    description: 'new summary',
    tags: ['new-tag', 'other'],
    body,
    kk_confidence: 'high',
    kk_relates_to: ['practice-neighbour'],
    kk_depends_on: [],
  };
}

interface ConflictFixture {
  id: string;
  target?: string;
  proposal?: Record<string, unknown> | null;
  status?: string;
  defaultDecision?: string | null;
  schemaVersion?: number | undefined;
}

function writeConflict(root: string, fx: ConflictFixture): string {
  const fm: Record<string, unknown> = {
    id: fx.id,
    status: fx.status ?? 'pending',
    detected_at: '2026-06-01T00:00:00Z',
    run_id: 'run-1',
    candidate_origin: ORIGIN,
    target_node_id: fx.target ?? TARGET,
    rationale: `because ${fx.id}`,
    proposal: fx.proposal === undefined ? proposal() : fx.proposal,
    default_decision: fx.defaultDecision ?? null,
    decided_at: null,
  };
  if (fx.schemaVersion !== undefined) fm['schema_version'] = fx.schemaVersion;
  const file = join(root, `.ai/kenkeep/conflicts/${fx.id}.md`);
  writeFileSync(file, matter.stringify(`## Rationale\n\nbecause ${fx.id}\n`, fm));
  return file;
}

function leafFiles(root: string, dir = join(root, '.ai/kenkeep/nodes')): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...leafFiles(root, full));
    else if (entry.name.endsWith('.md') && entry.name !== 'index.md') out.push(full);
  }
  return out.sort();
}

function readConflict(
  root: string,
  id: string
): { data: Record<string, unknown>; content: string } {
  const parsed = matter(readFileSync(join(root, `.ai/kenkeep/conflicts/${id}.md`), 'utf8'));
  return { data: parsed.data as Record<string, unknown>, content: parsed.content };
}

describe('kk conflict resolve (built CLI)', () => {
  let root: string;
  beforeEach(() => {
    root = sandboxRepo();
  });
  afterEach(() => cleanSandbox(root));

  it('accept rewrites the existing target in place: same id, same path, no new node', async () => {
    const targetFile = writeLeaf(root, 'topic', TARGET);
    const before = readFileSync(targetFile);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode, res.stderr).toBe(0);
    const out = JSON.parse(res.stdout) as Record<string, unknown>;
    expect(out).toMatchObject({
      id: 'run-1-1',
      decision: 'accept',
      status: 'accepted',
      target_node_id: TARGET,
      target_path: `topic/${TARGET}.md`,
    });
    expect(typeof out['decided_at']).toBe('string');

    // The original file changed and nothing else was created.
    expect(leafFiles(root)).toEqual([targetFile]);
    const after = readFileSync(targetFile);
    expect(after.equals(before)).toBe(false);
    const node = matter(after.toString('utf8'));
    expect(node.data['kk_id']).toBe(TARGET);
    expect(node.data['title']).toBe('New title');
    expect(node.data['description']).toBe('new summary');
    expect(node.data['tags']).toEqual(['new-tag', 'other']);
    expect(node.data['kk_relates_to']).toEqual(['practice-neighbour']);
    expect(node.data['kk_confidence']).toBe('high');
    expect(node.data['kk_derived_from']).toEqual(['old-session:practice:0', ORIGIN]);
    expect(node.content).toContain('New body from the proposal.');
    expect(existsSync(join(root, '.ai/kenkeep/nodes/topic/practice-practice-foo.md'))).toBe(false);

    const conflict = readConflict(root, 'run-1-1');
    expect(conflict.data['status']).toBe('accepted');
    expect(typeof conflict.data['decided_at']).toBe('string');
    // The full proposal is retained as the record of what was applied.
    expect(conflict.data['proposal']).toMatchObject({
      title: 'New title',
      tags: ['new-tag', 'other'],
    });
  });

  it.each([
    ['reject', 'rejected'],
    ['keep', 'kept'],
    ['skip', 'skipped'],
  ])('%s records status %s and leaves the target untouched', async (decision, status) => {
    const targetFile = writeLeaf(root, 'topic', TARGET);
    const before = readFileSync(targetFile);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', decision]);
    expect(res.exitCode, res.stderr).toBe(0);
    const out = JSON.parse(res.stdout) as Record<string, unknown>;
    expect(out).toMatchObject({ id: 'run-1-1', decision, status, target_node_id: TARGET });
    expect(readFileSync(targetFile).equals(before)).toBe(true);
    expect(leafFiles(root)).toEqual([targetFile]);
    expect(readConflict(root, 'run-1-1').data['status']).toBe(status);
  });

  it('accept refuses a target whose filename is not its id and writes no leaf', async () => {
    // foo is stored as manual.md and bar sits at foo's canonical filename.
    const fooFile = writeLeaf(root, 'topic', TARGET, 'TARGET ORIGINAL.\n');
    const manual = join(root, '.ai/kenkeep/nodes/topic/manual.md');
    renameSync(fooFile, manual);
    const barFile = writeLeaf(root, 'topic', 'practice-bar', 'UNRELATED FACT MUST SURVIVE.\n');
    renameSync(barFile, fooFile);
    const before = new Map(leafFiles(root).map(f => [f, readFileSync(f)]));
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode).toBe(1);
    const out = JSON.parse(res.stdout) as Record<string, unknown>;
    expect(out['status']).toBe('pending');
    expect(out['error']).toContain('topic/manual.md');
    expect(new Map(leafFiles(root).map(f => [f, readFileSync(f)]))).toEqual(before);
    expect(readConflict(root, 'run-1-1').data['status']).toBe('pending');
  });

  it('accept refuses a renamed target instead of creating a second copy', async () => {
    const fooFile = writeLeaf(root, 'topic', TARGET);
    const manual = join(root, '.ai/kenkeep/nodes/topic/manual.md');
    renameSync(fooFile, manual);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode).toBe(1);
    expect(leafFiles(root)).toEqual([manual]);
  });

  it('refuses a conflicts/ directory linked outside before touching the target', async () => {
    const targetFile = writeLeaf(root, 'topic', TARGET);
    const before = readFileSync(targetFile);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });
    const outside = join(root, 'outside');
    renameSync(join(root, '.ai/kenkeep/conflicts'), outside);
    symlinkSync(outside, join(root, '.ai/kenkeep/conflicts'), 'dir');
    const conflictBefore = readFileSync(join(outside, 'run-1-1.md'));

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('symlink');
    expect(readFileSync(targetFile)).toEqual(before);
    expect(readFileSync(join(outside, 'run-1-1.md'))).toEqual(conflictBefore);
  });

  it('a skipped conflict stays open: prepare lists it and it can be resolved later', async () => {
    writeLeaf(root, 'topic', TARGET);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });
    expect(
      (await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'skip'])).exitCode
    ).toBe(0);

    const prepared = await runCli(root, ['conflict', 'prepare']);
    expect(prepared.exitCode, prepared.stderr).toBe(0);
    const doc = JSON.parse(prepared.stdout) as {
      count: number;
      conflicts: Array<Record<string, unknown>>;
    };
    expect(doc.count).toBe(1);
    expect(doc.conflicts[0]).toMatchObject({ id: 'run-1-1', status: 'skipped' });

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'reject']);
    expect(res.exitCode, res.stderr).toBe(0);
    expect(readConflict(root, 'run-1-1').data['status']).toBe('rejected');

    // A decided conflict is no longer listed.
    const after = await runCli(root, ['conflict', 'prepare']);
    expect(JSON.parse(after.stdout)).toEqual({ count: 0, conflicts: [] });
  });

  it('with no --decision applies the default that prepare recorded', async () => {
    // Large rewrite at medium confidence -> prepare computes `reject` and
    // stamps it on the file; an empty reply then takes exactly that default.
    writeLeaf(root, 'topic', TARGET, 'a\nb\nc\nd\n');
    writeConflict(root, {
      id: 'run-1-1',
      schemaVersion: 2,
      proposal: { ...proposal('w\nx\ny\nz\nq\nr\n'), kk_confidence: 'medium' },
    });
    const prepared = await runCli(root, ['conflict', 'prepare']);
    expect(prepared.exitCode, prepared.stderr).toBe(0);
    const doc = JSON.parse(prepared.stdout) as { conflicts: Array<Record<string, unknown>> };
    expect(doc.conflicts[0]?.['default']).toBe('reject');
    expect(doc.conflicts[0]?.['ratio'] as number).toBeGreaterThan(0.5);
    expect(readConflict(root, 'run-1-1').data['default_decision']).toBe('reject');

    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1']);
    expect(res.exitCode, res.stderr).toBe(0);
    expect(JSON.parse(res.stdout)).toMatchObject({ decision: 'reject', status: 'rejected' });
  });

  it('with no --decision and no recorded default it refuses and points at prepare', async () => {
    writeLeaf(root, 'topic', TARGET);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });
    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1']);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('conflict prepare');
    expect(readConflict(root, 'run-1-1').data['status']).toBe('pending');
  });

  it('missing target: prepare defaults to skip, accept fails explicitly and creates no node', async () => {
    writeLeaf(root, 'topic', 'practice-unrelated');
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2, target: 'practice-gone' });
    const leavesBefore = leafFiles(root);

    const prepared = await runCli(root, ['conflict', 'prepare']);
    expect(prepared.exitCode, prepared.stderr).toBe(0);
    const doc = JSON.parse(prepared.stdout) as { conflicts: Array<Record<string, unknown>> };
    expect(doc.conflicts[0]).toMatchObject({
      target_node_id: 'practice-gone',
      existing: null,
      default: 'skip',
    });

    const accept = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(accept.exitCode).toBe(1);
    const out = JSON.parse(accept.stdout) as Record<string, unknown>;
    expect(out['status']).toBe('pending');
    expect(String(out['error'])).toContain('practice-gone');
    expect(leafFiles(root)).toEqual(leavesBefore);
    expect(readConflict(root, 'run-1-1').data['status']).toBe('pending');

    // The empty reply takes the displayed default (skip), never accept.
    const empty = await runCli(root, ['conflict', 'resolve', 'run-1-1']);
    expect(empty.exitCode, empty.stderr).toBe(0);
    expect(JSON.parse(empty.stdout)).toMatchObject({ decision: 'skip', status: 'skipped' });
    expect(leafFiles(root)).toEqual(leavesBefore);
  });

  it('accept on a contradiction without a proposal fails explicitly', async () => {
    const targetFile = writeLeaf(root, 'topic', TARGET);
    const before = readFileSync(targetFile);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2, proposal: null });
    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode).toBe(1);
    expect(JSON.parse(res.stdout)).toMatchObject({ status: 'pending' });
    expect(readFileSync(targetFile).equals(before)).toBe(true);
    expect(readConflict(root, 'run-1-1').data['status']).toBe('pending');
  });

  it('refuses to re-decide an already resolved conflict', async () => {
    writeLeaf(root, 'topic', TARGET);
    writeConflict(root, { id: 'run-1-1', schemaVersion: 2, status: 'kept' });
    const res = await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'accept']);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('kept');
  });

  it('rejects the legacy (unversioned) conflict shape with actionable guidance', async () => {
    writeLeaf(root, 'topic', TARGET);
    writeFileSync(
      join(root, '.ai/kenkeep/conflicts/old-1.md'),
      matter.stringify('## Rationale\n\nold\n\n## Proposed node\n\nold body\n', {
        id: 'old-1',
        status: 'pending',
        detected_at: '2026-06-01T00:00:00Z',
        run_id: 'old',
        candidate_origin: ORIGIN,
        target_node_id: TARGET,
        proposed_kind: 'practice',
        proposed_title: 'Old proposal',
        proposed_confidence: 'high',
      })
    );
    const prepared = await runCli(root, ['conflict', 'prepare']);
    expect(prepared.exitCode).toBe(1);
    expect(prepared.stdout).toBe('');
    expect(prepared.stderr).toContain('old-1.md');
    expect(prepared.stderr).toContain('schema_version');
    expect(prepared.stderr).toContain('status: kept');

    const resolved = await runCli(root, ['conflict', 'resolve', 'old-1', '--decision', 'reject']);
    expect(resolved.exitCode).toBe(1);
    expect(resolved.stderr).toContain('schema_version');
    expect(readConflict(root, 'old-1').data['status']).toBe('pending');

    // Following the guidance (marking it kept) takes it off the open list.
    const legacy = matter(readFileSync(join(root, '.ai/kenkeep/conflicts/old-1.md'), 'utf8'));
    writeFileSync(
      join(root, '.ai/kenkeep/conflicts/old-1.md'),
      matter.stringify(legacy.content, { ...legacy.data, status: 'kept' })
    );
    const cleared = await runCli(root, ['conflict', 'prepare']);
    expect(cleared.exitCode, cleared.stderr).toBe(0);
    expect(JSON.parse(cleared.stdout)).toEqual({ count: 0, conflicts: [] });
  });

  it('resolves by file path as well as by id, and refuses paths outside conflicts/', async () => {
    writeLeaf(root, 'topic', TARGET);
    const file = writeConflict(root, { id: 'run-1-1', schemaVersion: 2 });
    const byPath = await runCli(root, ['conflict', 'resolve', file, '--decision', 'keep']);
    expect(byPath.exitCode, byPath.stderr).toBe(0);
    expect(JSON.parse(byPath.stdout)).toMatchObject({ id: 'run-1-1', status: 'kept' });

    const outside = await runCli(root, [
      'conflict',
      'resolve',
      '../nodes/topic/practice-foo',
      '--decision',
      'keep',
    ]);
    expect(outside.exitCode).toBe(1);
    expect(outside.stdout).toBe('');
  });
});

describe('rebalance trigger excludes open conflict targets', () => {
  let root: string;
  beforeEach(() => {
    root = sandboxRepo();
  });
  afterEach(() => cleanSandbox(root));

  async function actions(): Promise<Array<{ branch: string; operation: string }>> {
    const res = await runCli(root, ['rebalance', 'trigger']);
    expect(res.exitCode, res.stderr).toBe(0);
    return (JSON.parse(res.stdout) as { actions: Array<{ branch: string; operation: string }> })
      .actions;
  }

  it('a homeless root leaf is not a create-branch candidate while it has a pending conflict', async () => {
    writeLeaf(root, '', 'practice-root');
    expect(await actions()).toEqual([{ branch: 'practice-root.md', operation: 'create-branch' }]);

    writeConflict(root, { id: 'run-1-1', schemaVersion: 2, target: 'practice-root' });
    expect(await actions()).toEqual([]);

    // A decided conflict releases the target again; a skipped one still holds it.
    await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'skip']);
    expect(await actions()).toEqual([]);
    await runCli(root, ['conflict', 'resolve', 'run-1-1', '--decision', 'reject']);
    expect(await actions()).toEqual([{ branch: 'practice-root.md', operation: 'create-branch' }]);
  });
});
