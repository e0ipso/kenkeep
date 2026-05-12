import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CURATOR_LOCK_NAME,
  buildBatchPayload,
  batchSessions,
  dedupActions,
  listPendingSessions,
  runCurate,
  type CuratorRunner,
} from '../../src/lib/curate.js';
import type { CuratorAction, NodeFrontmatter, Stage2Candidate } from '../../src/lib/schemas.js';
import { acquireLock, readState } from '../../src/lib/state.js';

interface Harness {
  root: string;
  kbDir: string;
  sessionsDir: string;
  nodesDir: string;
  logsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-curate-'));
  const kbDir = join(root, '.ai/knowledge-base');
  const sessionsDir = join(kbDir, '_sessions');
  const nodesDir = join(kbDir, 'nodes');
  const logsDir = join(kbDir, '_logs');
  const stateFile = join(root, '.ai/knowledge-base/.state/state.json');
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(nodesDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return { root, kbDir, sessionsDir, nodesDir, logsDir, stateFile };
}

function seedSession(
  harness: Harness,
  sessionId: string,
  practice: Stage2Candidate[],
  map: Stage2Candidate[],
  capturedAt = '2026-05-12T10:00:00Z'
): string {
  const filename = `session-${sessionId}.md`;
  const fm = {
    schema_version: 1,
    session_id: sessionId,
    captured_by: 'stop',
    captured_at: capturedAt,
    transcript_hash: `sha256:${sessionId}`,
    stage_2_status: 'done',
    stage_2_completed_at: capturedAt,
    stage_2_error: null,
    stage_2_log: `_logs/stage-2/${sessionId}.jsonl`,
    secret_scan_status: 'clean',
    topics: [],
    proposals: { practice, map },
  };
  const body = matter.stringify('## Stage 2: structured summary\n', fm);
  writeFileSync(join(harness.sessionsDir, filename), body);
  return filename;
}

function seedExistingNode(
  harness: Harness,
  kind: 'practice' | 'map',
  id: string,
  body = '# existing\nold body\n'
): void {
  const dir = join(harness.nodesDir, kind);
  mkdirSync(dir, { recursive: true });
  const fm = {
    schema_version: 1,
    id,
    title: `${id} title`,
    kind,
    tags: [],
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: null,
    updated: '2026-01-01T00:00:00Z',
    supersedes: null,
    superseded_by: null,
    derived_from: [],
    relates_to: [],
    depends_on: [],
    confidence: 'high',
    summary: 'existing summary',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(body, fm));
}

function makeCandidate(kind: 'practice' | 'map', title: string): Stage2Candidate {
  return {
    kind,
    tags: ['t'],
    title,
    summary: `summary of ${title}`,
    body: `body for ${title}`,
    confidence: 'high',
    supports_existing_node: null,
    contradicts_existing_node: null,
  };
}

function makeAction(
  action: 'add' | 'modify' | 'contradict' | 'drop',
  overrides: Partial<CuratorAction> = {}
): CuratorAction {
  const base: CuratorAction = {
    action,
    candidate_origin: 's:practice:0',
    target_node_id: null,
    proposed_node:
      action === 'drop'
        ? null
        : {
            id: `practice-${action}-node`,
            title: 'Proposed title',
            kind: 'practice',
            tags: ['t'],
            summary: 'Proposed summary',
            body: '# Proposed\n\nBody.',
            confidence: 'high',
            derived_from: ['session-1.md'],
            relates_to: [],
            supersedes: null,
            valid_from: '2026-05-12T10:00:00Z',
            valid_until: null,
            superseded_by: null,
          },
    rationale: 'because',
    suggested_resolution: null,
  };
  return { ...base, ...overrides };
}

const PROMPT_TEMPLATE = 'You are the curator.\n\n[BATCH PLACEHOLDER — substituted at runtime]';

describe('listPendingSessions', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns only stage_2_status=done sessions that have not yet been curated', () => {
    seedSession(harness, 'a', [makeCandidate('practice', 'A')], []);
    // pending session — not yet stage-2 done.
    const fm = {
      schema_version: 1,
      session_id: 'pending',
      captured_by: 'stop',
      captured_at: '2026-05-12T10:00:00Z',
      transcript_hash: 'sha256:pending',
      stage_2_status: 'pending',
      stage_2_completed_at: null,
      stage_2_error: null,
      stage_2_log: null,
      secret_scan_status: 'clean',
      topics: [],
      proposals: { practice: [], map: [] },
    };
    writeFileSync(join(harness.sessionsDir, 'session-pending.md'), matter.stringify('# x', fm));
    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions.map(s => s.sessionId)).toEqual(['a']);
  });
});

describe('batchSessions', () => {
  it('respects the per-batch session count limit', () => {
    const sessions = Array.from({ length: 25 }, (_, i) => ({
      filename: `s-${i}.md`,
      filePath: `s-${i}.md`,
      sessionId: `s-${i}`,
      capturedAt: '2026-05-12T10:00:00Z',
      topics: [],
      practiceCandidates: [makeCandidate('practice', `c-${i}`)],
      mapCandidates: [],
    }));
    const batches = batchSessions(sessions, 10, 1_000_000);
    expect(batches.map(b => b.length)).toEqual([10, 10, 5]);
  });
});

describe('dedupActions', () => {
  it('keeps the higher-confidence action when two propose the same id', () => {
    const a = makeAction('add', {
      proposed_node: {
        id: 'practice-foo',
        title: 'Foo',
        kind: 'practice',
        tags: [],
        summary: 'low',
        body: 'body',
        confidence: 'low',
        derived_from: [],
        relates_to: [],
        supersedes: null,
        valid_from: '2026-05-12T10:00:00Z',
        valid_until: null,
        superseded_by: null,
      },
    });
    const b = makeAction('add', {
      proposed_node: {
        id: 'practice-foo',
        title: 'Foo',
        kind: 'practice',
        tags: [],
        summary: 'high',
        body: 'body',
        confidence: 'high',
        derived_from: [],
        relates_to: [],
        supersedes: null,
        valid_from: '2026-05-12T10:00:00Z',
        valid_until: null,
        superseded_by: null,
      },
    });
    const merged = dedupActions([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.proposed_node?.summary).toBe('high');
  });
});

describe('runCurate', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  function ctx(runner: CuratorRunner) {
    return {
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    };
  }

  it('writes a node per add action and marks the session as processed', async () => {
    seedSession(harness, 's1', [makeCandidate('practice', 'Use X')], []);
    const runner: CuratorRunner = async () => [
      makeAction('add', {
        proposed_node: {
          id: 'practice-use-x',
          title: 'Use X',
          kind: 'practice',
          tags: ['x'],
          summary: 'Use X everywhere',
          body: '# Use X\nBody.\n',
          confidence: 'high',
          derived_from: ['session-s1.md'],
          relates_to: [],
          supersedes: null,
          valid_from: '2026-05-12T10:00:00Z',
          valid_until: null,
          superseded_by: null,
        },
      }),
    ];

    const result = await runCurate(ctx(runner));

    expect(result.status).toBe('completed');
    expect(result.nodesWritten).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toEqual([]);
    const nodeFile = join(harness.nodesDir, 'practice', 'practice-use-x.md');
    expect(existsSync(nodeFile)).toBe(true);
    // Frontmatter is the pure node shape — no `proposal:` block.
    const fm = matter(readFileSync(nodeFile, 'utf8')).data as Record<string, unknown>;
    expect(fm).not.toHaveProperty('proposal');
    expect(fm['id']).toBe('practice-use-x');
    expect((fm as NodeFrontmatter).title).toBe('Use X');
    // INDEX/GRAPH regenerated.
    expect(existsSync(join(harness.kbDir, 'INDEX.md'))).toBe(true);
    expect(existsSync(join(harness.kbDir, 'GRAPH.md'))).toBe(true);
    // Session marked as curator_processed.
    const after = matter(readFileSync(join(harness.sessionsDir, 'session-s1.md'), 'utf8'));
    expect(typeof (after.data as Record<string, unknown>)['curator_processed_at']).toBe('string');
    expect(typeof (after.data as Record<string, unknown>)['curator_run_id']).toBe('string');
  });

  it('modify overwrites the targeted node; contradict records a conflict without writing', async () => {
    seedExistingNode(harness, 'practice', 'practice-mod-target', '# orig\n');
    seedExistingNode(harness, 'practice', 'practice-contra-target', '# orig contra\n');
    seedSession(harness, 's', [makeCandidate('practice', 'M'), makeCandidate('practice', 'C')], []);
    const runner: CuratorRunner = async () => [
      makeAction('modify', {
        target_node_id: 'practice-mod-target',
        proposed_node: {
          id: 'practice-mod-target',
          title: 'Modified Title',
          kind: 'practice',
          tags: ['m'],
          summary: 'merged summary',
          body: '# Merged\nUpdated body.\n',
          confidence: 'high',
          derived_from: [],
          relates_to: [],
          supersedes: null,
          valid_from: '2026-05-12T10:00:00Z',
          valid_until: null,
          superseded_by: null,
        },
      }),
      makeAction('contradict', { target_node_id: 'practice-contra-target' }),
    ];

    const result = await runCurate(ctx(runner));

    expect(result.nodesWritten).toBe(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.failures).toEqual([]);
    // modify overwrote the original.
    const mod = matter(
      readFileSync(join(harness.nodesDir, 'practice', 'practice-mod-target.md'), 'utf8')
    );
    expect((mod.data as NodeFrontmatter).title).toBe('Modified Title');
    expect(mod.content).toContain('Updated body');
    // contradict left the original alone.
    const contra = readFileSync(
      join(harness.nodesDir, 'practice', 'practice-contra-target.md'),
      'utf8'
    );
    expect(contra).toContain('orig contra');
    // Conflict report is shaped correctly.
    const c = result.conflicts[0]!;
    expect(c.target_node_id).toBe('practice-contra-target');
    expect(c.rationale).toBe('because');
    expect(c.proposed_node?.id).toBe('practice-contradict-node');
  });

  it('add against an existing node is a fail-loud failure (no overwrite)', async () => {
    seedExistingNode(harness, 'practice', 'practice-collide', '# pre-existing\n');
    seedSession(harness, 's', [makeCandidate('practice', 'C')], []);
    const runner: CuratorRunner = async () => [
      makeAction('add', {
        proposed_node: {
          id: 'practice-collide',
          title: 'Collide',
          kind: 'practice',
          tags: [],
          summary: 'new',
          body: '# overwrite-attempt\n',
          confidence: 'high',
          derived_from: [],
          relates_to: [],
          supersedes: null,
          valid_from: '2026-05-12T10:00:00Z',
          valid_until: null,
          superseded_by: null,
        },
      }),
    ];
    const result = await runCurate(ctx(runner));
    expect(result.nodesWritten).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe('add_collision');
    // Original untouched.
    const after = readFileSync(join(harness.nodesDir, 'practice', 'practice-collide.md'), 'utf8');
    expect(after).toContain('pre-existing');
  });

  it('modify against a missing target_node is a fail-loud failure (no write)', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'X')], []);
    const runner: CuratorRunner = async () => [
      makeAction('modify', {
        target_node_id: 'practice-does-not-exist',
        proposed_node: {
          id: 'practice-does-not-exist',
          title: 'Phantom',
          kind: 'practice',
          tags: [],
          summary: 's',
          body: 'body',
          confidence: 'high',
          derived_from: [],
          relates_to: [],
          supersedes: null,
          valid_from: '2026-05-12T10:00:00Z',
          valid_until: null,
          superseded_by: null,
        },
      }),
    ];
    const result = await runCurate(ctx(runner));
    expect(result.nodesWritten).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.reason).toBe('modify_missing_target');
    expect(existsSync(join(harness.nodesDir, 'practice', 'practice-does-not-exist.md'))).toBe(
      false
    );
  });

  it('returns status=locked when another process holds the curator lock', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    acquireLock(harness.stateFile, {
      name: CURATOR_LOCK_NAME,
      pid: 999_999,
      now: new Date(),
    });
    const result = await runCurate({
      ...ctx(async () => []),
      pid: 12345,
    });
    expect(result.status).toBe('locked');
  });

  it('releases the lock after completion', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    await runCurate(ctx(async () => []));
    expect(readState(harness.stateFile).lock ?? null).toBeNull();
  });

  it('reports no-pending and still regenerates INDEX/GRAPH when nothing is queued', async () => {
    const result = await runCurate(ctx(async () => []));
    expect(result.status).toBe('no-pending');
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(existsSync(join(harness.kbDir, 'INDEX.md'))).toBe(true);
  });

  it('buildBatchPayload includes referenced existing nodes only', () => {
    // Two existing nodes; only one is referenced by the batch.
    seedExistingNode(harness, 'practice', 'practice-x');
    seedExistingNode(harness, 'practice', 'practice-y');
    seedSession(
      harness,
      's',
      [{ ...makeCandidate('practice', 'Hi'), supports_existing_node: 'practice-x' }],
      []
    );
    const sessions = listPendingSessions(harness.sessionsDir);
    const payload = buildBatchPayload(sessions, harness.kbDir, harness.nodesDir);
    expect(payload.existing_nodes.map(n => n.id)).toEqual(['practice-x']);
  });
});
