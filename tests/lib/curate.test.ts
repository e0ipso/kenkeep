import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
import type { CuratorAction, Stage2Candidate } from '../../src/lib/schemas.js';
import { acquireLock, readState } from '../../src/lib/state.js';

interface Harness {
  root: string;
  kbDir: string;
  sessionsDir: string;
  nodesDir: string;
  proposedDir: string;
  logsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-curate-'));
  const kbDir = join(root, '.ai/knowledge-base');
  const sessionsDir = join(kbDir, '_sessions');
  const nodesDir = join(kbDir, 'nodes');
  const proposedDir = join(kbDir, '_proposed');
  const logsDir = join(kbDir, '_logs');
  const stateFile = join(root, '.ai/knowledge-base/.state/state.json');
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(nodesDir, { recursive: true });
  mkdirSync(proposedDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return { root, kbDir, sessionsDir, nodesDir, proposedDir, logsDir, stateFile };
}

function seedSession(
  harness: Harness,
  sessionId: string,
  practice: Stage2Candidate[],
  map: Stage2Candidate[],
  capturedAt = '2026-05-11T10:00:00Z',
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
    gitleaks_status: 'clean',
    topics: [],
    proposals: { practice, map },
  };
  const body = matter.stringify('## Stage 2: structured summary\n', fm);
  writeFileSync(join(harness.sessionsDir, filename), body);
  return filename;
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
  overrides: Partial<CuratorAction> = {},
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
            valid_from: '2026-05-11T10:00:00Z',
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
      captured_at: '2026-05-11T10:00:00Z',
      transcript_hash: 'sha256:pending',
      stage_2_status: 'pending',
      stage_2_completed_at: null,
      stage_2_error: null,
      stage_2_log: null,
      gitleaks_status: 'clean',
      topics: [],
      proposals: { practice: [], map: [] },
    };
    writeFileSync(join(harness.sessionsDir, 'session-pending.md'), matter.stringify('# x', fm));
    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions.map((s) => s.sessionId)).toEqual(['a']);
  });
});

describe('batchSessions', () => {
  it('respects the per-batch session count limit', () => {
    const sessions = Array.from({ length: 25 }, (_, i) => ({
      filename: `s-${i}.md`,
      filePath: `s-${i}.md`,
      sessionId: `s-${i}`,
      capturedAt: '2026-05-11T10:00:00Z',
      topics: [],
      practiceCandidates: [makeCandidate('practice', `c-${i}`)],
      mapCandidates: [],
    }));
    const batches = batchSessions(sessions, 10, 1_000_000);
    expect(batches.map((b) => b.length)).toEqual([10, 10, 5]);
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
        valid_from: '2026-05-11T10:00:00Z',
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
        valid_from: '2026-05-11T10:00:00Z',
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

  it('writes a proposal per non-drop action and marks the session as processed', async () => {
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
          valid_from: '2026-05-11T10:00:00Z',
          valid_until: null,
          superseded_by: null,
        },
      }),
    ];

    const result = await runCurate({
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });

    expect(result.status).toBe('completed');
    expect(result.proposalsWritten).toBe(1);
    expect(existsSync(join(harness.proposedDir, 'additions', 'practice-use-x.md'))).toBe(true);
    // INDEX/GRAPH regenerated.
    expect(existsSync(join(harness.kbDir, 'INDEX.md'))).toBe(true);
    expect(existsSync(join(harness.kbDir, 'GRAPH.md'))).toBe(true);
    // Session marked as curator_processed.
    const after = matter(readFileSync(join(harness.sessionsDir, 'session-s1.md'), 'utf8'));
    expect(typeof (after.data as Record<string, unknown>)['curator_processed_at']).toBe('string');
    expect(typeof (after.data as Record<string, unknown>)['curator_run_id']).toBe('string');
  });

  it('routes modifications, contradictions, and additions to the right folders', async () => {
    seedSession(
      harness,
      's',
      [
        makeCandidate('practice', 'Add'),
        makeCandidate('practice', 'Mod'),
        makeCandidate('practice', 'Contradict'),
      ],
      [],
    );
    const runner: CuratorRunner = async () => [
      makeAction('add'),
      makeAction('modify', { target_node_id: 'practice-mod-target' }),
      makeAction('contradict', { target_node_id: 'practice-contra-target' }),
    ];
    await runCurate({
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });
    expect(readdirSync(join(harness.proposedDir, 'additions'))).toHaveLength(1);
    expect(readdirSync(join(harness.proposedDir, 'modifications'))).toHaveLength(1);
    expect(readdirSync(join(harness.proposedDir, 'contradictions'))).toHaveLength(1);
    // Contradiction proposal must NOT auto-pick a resolution.
    const contradictFile = join(
      harness.proposedDir,
      'contradictions',
      readdirSync(join(harness.proposedDir, 'contradictions'))[0]!,
    );
    const fm = matter(readFileSync(contradictFile, 'utf8')).data as {
      proposal: { suggested_resolution: string | null };
    };
    expect(fm.proposal.suggested_resolution).toBeNull();
  });

  it('returns status=locked when another process holds the curator lock', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    acquireLock(harness.stateFile, {
      name: CURATOR_LOCK_NAME,
      pid: 999_999,
      now: new Date(),
    });
    const result = await runCurate({
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: async () => [],
      pid: 12345,
    });
    expect(result.status).toBe('locked');
  });

  it('releases the lock after completion', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    await runCurate({
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: async () => [],
    });
    expect(readState(harness.stateFile).lock ?? null).toBeNull();
  });

  it('reports no-pending and still regenerates INDEX/GRAPH when nothing is queued', async () => {
    const result = await runCurate({
      kbDir: harness.kbDir,
      sessionsDir: harness.sessionsDir,
      nodesDir: harness.nodesDir,
      proposedDir: harness.proposedDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: async () => [],
    });
    expect(result.status).toBe('no-pending');
    expect(existsSync(join(harness.kbDir, 'INDEX.md'))).toBe(true);
  });

  it('buildBatchPayload includes referenced existing nodes only', () => {
    // Two existing nodes; only one is referenced by the batch.
    mkdirSync(join(harness.nodesDir, 'practice'), { recursive: true });
    for (const id of ['practice-x', 'practice-y']) {
      const fm = matter.stringify(`# ${id}\nBody.\n`, {
        schema_version: 1,
        id,
        title: id,
        kind: 'practice',
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
        summary: 's',
      });
      writeFileSync(join(harness.nodesDir, 'practice', `${id}.md`), fm);
    }
    seedSession(
      harness,
      's',
      [{ ...makeCandidate('practice', 'Hi'), supports_existing_node: 'practice-x' }],
      [],
    );
    const sessions = listPendingSessions(harness.sessionsDir);
    const payload = buildBatchPayload(sessions, harness.kbDir, harness.nodesDir);
    expect(payload.existing_nodes.map((n) => n.id)).toEqual(['practice-x']);
  });
});
