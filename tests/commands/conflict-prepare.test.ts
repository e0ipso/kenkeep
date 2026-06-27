import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runConflictPrepareCommand } from '../../src/commands/conflict-prepare.js';

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'kk-conflict-prepare-'));
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

function writeNode(root: string, id: string, body: string): void {
  writeFileSync(
    join(root, `.ai/kenkeep/nodes/topic/${id}.md`),
    matter.stringify(body, {
      schema_version: 2,
      id,
      title: `Title ${id}`,
      kind: 'practice',
      tags: ['t'],
      derived_from: ['s:practice:0'],
      relates_to: [],
      depends_on: [],
      confidence: 'high',
      summary: `summary ${id}`,
    })
  );
}

function writeConflict(
  root: string,
  opts: {
    id: string;
    target: string | null;
    kind?: string;
    confidence?: string;
    detectedAt?: string;
    proposedBody: string;
    status?: string;
  }
): void {
  const fm = {
    id: opts.id,
    status: opts.status ?? 'pending',
    detected_at: opts.detectedAt ?? '2026-06-01T00:00:00Z',
    run_id: 'run-1',
    candidate_origin: 'sess:practice:0',
    target_node_id: opts.target,
    proposed_kind: opts.kind ?? 'practice',
    proposed_title: `Proposed ${opts.id}`,
    proposed_confidence: opts.confidence ?? 'medium',
  };
  const body = `## Rationale\n\nbecause ${opts.id}\n\n## Proposed node\n\n${opts.proposedBody}\n`;
  writeFileSync(join(root, `.ai/kenkeep/conflicts/${opts.id}.md`), matter.stringify(body, fm));
}

async function capture(
  fn: () => Promise<number>
): Promise<{ code: number; json: { count: number; conflicts: Array<Record<string, unknown>> } }> {
  let stdout = '';
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  });
  try {
    const code = await fn();
    return { code, json: JSON.parse(stdout) };
  } finally {
    spy.mockRestore();
  }
}

describe('kk conflict prepare', () => {
  let cwd: string;
  let original: string;

  beforeEach(() => {
    original = process.cwd();
    cwd = sandbox();
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(cwd, { recursive: true, force: true });
  });

  it('computes default y for a small change with high confidence', async () => {
    const body = 'line a\nline b\nline c\n';
    writeNode(cwd, 'practice-foo', body);
    // One-line change, high confidence -> lines_changed < 5 -> y.
    writeConflict(cwd, {
      id: 'c1',
      target: 'practice-foo',
      confidence: 'high',
      proposedBody: 'line a\nline b\nline c CHANGED\n',
    });
    const { code, json } = await capture(() => runConflictPrepareCommand());
    expect(code).toBe(0);
    expect(json.count).toBe(1);
    expect(json.conflicts[0].default).toBe('y');
  });

  it('computes default n for a large change (ratio > 0.5)', async () => {
    writeNode(cwd, 'practice-bar', 'a\nb\nc\nd\n');
    // Fully rewritten body -> ratio 1.0 -> n. Medium confidence so the y rule
    // never fires even though it is a different size.
    writeConflict(cwd, {
      id: 'c2',
      target: 'practice-bar',
      confidence: 'medium',
      proposedBody: 'w\nx\ny\nz\nq\nr\n',
    });
    const { json } = await capture(() => runConflictPrepareCommand());
    expect(json.conflicts[0].default).toBe('n');
    expect(json.conflicts[0].ratio as number).toBeGreaterThan(0.5);
  });

  it('computes default s for a middling change', async () => {
    // 12-line body sharing 9 lines, 3 replaced -> lines_changed = 6 (3 del + 3 add),
    // total_lines = 12, ratio = 0.5 (not > 0.5). lines_changed >= 5 and not high
    // confidence -> falls through both rules to s.
    const existing = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n') + '\n';
    const proposed =
      Array.from({ length: 9 }, (_, i) => `line ${i}`).join('\n') + '\nX\nY\nZ\n';
    writeNode(cwd, 'practice-baz', existing);
    writeConflict(cwd, {
      id: 'c3',
      target: 'practice-baz',
      confidence: 'medium',
      proposedBody: proposed,
    });
    const { json } = await capture(() => runConflictPrepareCommand());
    const c = json.conflicts[0];
    expect(c.ratio as number).toBeLessThanOrEqual(0.5);
    expect(c.lines_changed as number).toBeGreaterThanOrEqual(5);
    expect(c.default).toBe('s');
  });

  it('defaults to s when there is no target node', async () => {
    writeConflict(cwd, { id: 'c4', target: null, proposedBody: 'orphan body\n' });
    const { json } = await capture(() => runConflictPrepareCommand());
    expect(json.conflicts[0].default).toBe('s');
    expect(json.conflicts[0].existing).toBeNull();
  });

  it('sorts by target_node_id (null last) and groups consecutive same-target conflicts', async () => {
    writeNode(cwd, 'practice-aaa', 'a\nb\n');
    writeNode(cwd, 'practice-bbb', 'a\nb\n');
    // Insertion order deliberately scrambled; expect aaa, aaa, bbb, then null.
    writeConflict(cwd, { id: 'z-null', target: null, proposedBody: 'x\n' });
    writeConflict(cwd, {
      id: 'b-bbb',
      target: 'practice-bbb',
      detectedAt: '2026-06-02T00:00:00Z',
      proposedBody: 'x\n',
    });
    writeConflict(cwd, {
      id: 'a-aaa-2',
      target: 'practice-aaa',
      detectedAt: '2026-06-03T00:00:00Z',
      proposedBody: 'x\n',
    });
    writeConflict(cwd, {
      id: 'a-aaa-1',
      target: 'practice-aaa',
      detectedAt: '2026-06-01T00:00:00Z',
      proposedBody: 'x\n',
    });
    const { json } = await capture(() => runConflictPrepareCommand());
    const order = json.conflicts.map(c => c.target_node_id);
    expect(order).toEqual(['practice-aaa', 'practice-aaa', 'practice-bbb', null]);
    // First aaa conflict starts a group and carries the existing node; the
    // second aaa conflict is in the same group with no repeated existing block.
    expect(json.conflicts[0].first_in_group).toBe(true);
    expect(json.conflicts[0].existing).not.toBeNull();
    expect(json.conflicts[1].first_in_group).toBe(false);
    expect(json.conflicts[1].existing).toBeNull();
    expect(json.conflicts[2].first_in_group).toBe(true);
    // detected_at orders the two aaa conflicts.
    expect(json.conflicts[0].id).toBe('a-aaa-1');
    expect(json.conflicts[1].id).toBe('a-aaa-2');
  });

  it('skips non-pending conflicts', async () => {
    writeConflict(cwd, { id: 'resolved', target: null, status: 'resolved', proposedBody: 'x\n' });
    const { json } = await capture(() => runConflictPrepareCommand());
    expect(json.count).toBe(0);
  });
});
