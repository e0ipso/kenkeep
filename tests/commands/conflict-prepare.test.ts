import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
      kk_schema_version: 3,
      kk_id: id,
      title: `Title ${id}`,
      type: 'practice',
      description: `summary ${id}`,
      tags: ['t'],
      kk_derived_from: ['s:practice:0'],
      kk_relates_to: [],
      kk_depends_on: [],
      kk_confidence: 'high',
    })
  );
}

function writeConflict(
  root: string,
  opts: {
    id: string;
    target: string;
    kind?: string;
    confidence?: string;
    detectedAt?: string;
    /** `null` records a contradiction that proposes no rewrite. */
    proposedBody: string | null;
    status?: string;
    defaultDecision?: string | null;
  }
): void {
  const fm = {
    schema_version: 2,
    id: opts.id,
    status: opts.status ?? 'pending',
    detected_at: opts.detectedAt ?? '2026-06-01T00:00:00Z',
    run_id: 'run-1',
    candidate_origin: 'sess:practice:0',
    target_node_id: opts.target,
    rationale: `because ${opts.id}`,
    proposal:
      opts.proposedBody === null
        ? null
        : {
            title: `Proposed ${opts.id}`,
            type: opts.kind ?? 'practice',
            tags: ['t'],
            description: `proposed summary ${opts.id}`,
            body: opts.proposedBody,
            kk_confidence: opts.confidence ?? 'medium',
            kk_relates_to: [],
            kk_depends_on: [],
          },
    default_decision: opts.defaultDecision ?? null,
    decided_at: null,
  };
  writeFileSync(
    join(root, `.ai/kenkeep/conflicts/${opts.id}.md`),
    matter.stringify(`## Rationale\n\nbecause ${opts.id}\n`, fm)
  );
}

function readConflictData(root: string, id: string): Record<string, unknown> {
  return matter(readFileSync(join(root, `.ai/kenkeep/conflicts/${id}.md`), 'utf8')).data as Record<
    string,
    unknown
  >;
}

async function capture(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  json: { count: number; conflicts: Array<Record<string, unknown>> };
}> {
  let stdout = '';
  let stderr = '';
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  });
  const err = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr += `${args.join(' ')}\n`;
  });
  try {
    const code = await fn();
    const json = stdout === '' ? { count: 0, conflicts: [] } : JSON.parse(stdout);
    return { code, stdout, stderr, json };
  } finally {
    out.mockRestore();
    err.mockRestore();
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

  it('computes default accept for a small change with high confidence and stamps it', async () => {
    const body = 'line a\nline b\nline c\n';
    writeNode(cwd, 'practice-foo', body);
    // One-line change, high confidence -> lines_changed < 5 -> accept.
    writeConflict(cwd, {
      id: 'c1',
      target: 'practice-foo',
      confidence: 'high',
      proposedBody: 'line a\nline b\nline c CHANGED\n',
    });
    const { code, json } = await capture(() => runConflictPrepareCommand());
    expect(code).toBe(0);
    expect(json.count).toBe(1);
    const c = json.conflicts[0]!;
    expect(c['default']).toBe('accept');
    expect(c['default_decision']).toBe('accept');
    expect(c['has_proposal']).toBe(true);
    // The full proposal travels with the record so the skill renders it as-is.
    expect(c['proposal']).toMatchObject({
      title: 'Proposed c1',
      description: 'proposed summary c1',
    });
    expect(c['rationale']).toBe('because c1');
    // The displayed default is recorded on the file for `conflict resolve`.
    expect(readConflictData(cwd, 'c1')['default_decision']).toBe('accept');
  });

  it('refuses a conflicts/ directory linked outside the knowledge base and writes nothing', async () => {
    writeNode(cwd, 'practice-foo', 'line a\n');
    writeConflict(cwd, { id: 'c1', target: 'practice-foo', proposedBody: 'line b\n' });
    const outside = join(cwd, 'outside');
    renameSync(join(cwd, '.ai/kenkeep/conflicts'), outside);
    symlinkSync(outside, join(cwd, '.ai/kenkeep/conflicts'), 'dir');
    const before = readFileSync(join(outside, 'c1.md'));

    const { code, stdout, stderr } = await capture(() => runConflictPrepareCommand());
    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('symlink');
    expect(readFileSync(join(outside, 'c1.md'))).toEqual(before);
  });

  it('refuses a linked conflict file before stamping any other conflict', async () => {
    writeNode(cwd, 'practice-a', 'line a\n');
    writeNode(cwd, 'practice-b', 'line a\n');
    writeConflict(cwd, { id: 'c1', target: 'practice-a', proposedBody: 'line b\n' });
    writeConflict(cwd, { id: 'c2', target: 'practice-b', proposedBody: 'line b\n' });
    const outside = join(cwd, 'outside.md');
    renameSync(join(cwd, '.ai/kenkeep/conflicts/c2.md'), outside);
    symlinkSync(outside, join(cwd, '.ai/kenkeep/conflicts/c2.md'));
    const before = readFileSync(outside);

    const { code, stderr } = await capture(() => runConflictPrepareCommand());
    expect(code).toBe(1);
    expect(stderr).toContain('symlink');
    expect(readConflictData(cwd, 'c1')['default_decision']).toBeNull();
    expect(lstatSync(join(cwd, '.ai/kenkeep/conflicts/c2.md')).isSymbolicLink()).toBe(true);
    expect(readFileSync(outside)).toEqual(before);
  });

  it('computes default skip for a middling change', async () => {
    // 12-line body sharing 9 lines, 3 replaced -> lines_changed = 6 (3 del + 3 add),
    // total_lines = 12, ratio = 0.5 (not > 0.5). lines_changed >= 5 and not high
    // confidence -> falls through both rules to skip.
    const existing = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n') + '\n';
    const proposed = Array.from({ length: 9 }, (_, i) => `line ${i}`).join('\n') + '\nX\nY\nZ\n';
    writeNode(cwd, 'practice-baz', existing);
    writeConflict(cwd, {
      id: 'c3',
      target: 'practice-baz',
      confidence: 'medium',
      proposedBody: proposed,
    });
    const { json } = await capture(() => runConflictPrepareCommand());
    const c = json.conflicts[0]!;
    expect(c['ratio'] as number).toBeLessThanOrEqual(0.5);
    expect(c['lines_changed'] as number).toBeGreaterThanOrEqual(5);
    expect(c['default']).toBe('skip');
  });

  it('re-stamps a stale recorded default instead of trusting it', async () => {
    writeNode(cwd, 'practice-foo', 'a\n');
    // A recorded `accept` that the current rules no longer support: a full
    // rewrite at medium confidence computes `reject`, and the file follows.
    writeConflict(cwd, {
      id: 'c5',
      target: 'practice-foo',
      confidence: 'medium',
      proposedBody: 'x\ny\nz\n',
      defaultDecision: 'accept',
    });
    const { json } = await capture(() => runConflictPrepareCommand());
    expect(json.conflicts[0]!['default']).toBe('reject');
    expect(readConflictData(cwd, 'c5')['default_decision']).toBe('reject');
  });

  it('sorts by target_node_id, then kind, then detected_at and groups same-target conflicts', async () => {
    writeNode(cwd, 'practice-aaa', 'a\nb\n');
    writeNode(cwd, 'practice-bbb', 'a\nb\n');
    // Insertion order deliberately scrambled; expect aaa, aaa, bbb.
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
    expect(json.conflicts.map(c => c['target_node_id'])).toEqual([
      'practice-aaa',
      'practice-aaa',
      'practice-bbb',
    ]);
    // First aaa conflict starts a group and carries the existing node; the
    // second aaa conflict is in the same group with no repeated existing block.
    expect(json.conflicts[0]!['first_in_group']).toBe(true);
    expect(json.conflicts[0]!['existing']).not.toBeNull();
    expect(json.conflicts[1]!['first_in_group']).toBe(false);
    expect(json.conflicts[1]!['existing']).toBeNull();
    expect(json.conflicts[2]!['first_in_group']).toBe(true);
    // detected_at orders the two aaa conflicts.
    expect(json.conflicts[0]!['id']).toBe('a-aaa-1');
    expect(json.conflicts[1]!['id']).toBe('a-aaa-2');
  });

  it('a contradiction without a proposed node yields a usable record: existing node rendered, no proposal, default skip', async () => {
    writeNode(cwd, 'practice-foo', 'line a\nline b\n');
    writeConflict(cwd, { id: 'c-noprop', target: 'practice-foo', proposedBody: null });
    const { code, json } = await capture(() => runConflictPrepareCommand());
    expect(code).toBe(0);
    expect(json.count).toBe(1);
    const c = json.conflicts[0]!;
    expect(c['target_node_id']).toBe('practice-foo');
    expect(c['has_proposal']).toBe(false);
    expect(c['proposal']).toBeNull();
    expect(c['rationale']).toBe('because c-noprop');
    expect(c['existing']).not.toBeNull();
    // Nothing to accept, so the only honest default is to hold for the human.
    expect(c['default']).toBe('skip');
    expect(c['lines_changed']).toBe(0);
  });
});
