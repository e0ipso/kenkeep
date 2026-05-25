import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  dedupActions,
  listPendingSessions,
  markSessionsProcessed,
  mintConflictId,
} from '../../src/lib/curate.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import type { CuratorAction, ProposalCandidate } from '../../src/lib/schemas.js';
import {
  CuratorOutputSchema,
  CuratorProposedNodeSchema,
  ProposalCandidateSchema,
} from '../../src/lib/schemas.js';

interface Harness {
  root: string;
  paths: RepoPaths;
  sessionsDir: string;
  nodesDir: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-curate-'));
  const paths = repoPaths(root);
  mkdirSync(paths.sessionsDir, { recursive: true });
  mkdirSync(paths.nodesDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  return {
    root,
    paths,
    sessionsDir: paths.sessionsDir,
    nodesDir: paths.nodesDir,
  };
}

function seedSession(
  harness: Harness,
  sessionId: string,
  practice: ProposalCandidate[],
  map: ProposalCandidate[],
  capturedAt = '2026-05-12T10:00:00Z'
): string {
  const filename = `session-${sessionId}.md`;
  const fm = {
    schema_version: 1,
    session_id: sessionId,
    captured_by: 'stop',
    captured_at: capturedAt,
    transcript_hash: `sha256:${sessionId}`,
    proposal_status: 'done',
    proposal_completed_at: capturedAt,
    proposal_error: null,
    proposal_log: `_logs/proposal/${sessionId}.jsonl`,
    proposals: { practice, map },
  };
  const body = matter.stringify('## Proposal\n', fm);
  writeFileSync(join(harness.sessionsDir, filename), body);
  return filename;
}

function makeCandidate(kind: 'practice' | 'map', title: string): ProposalCandidate {
  return {
    kind,
    tags: ['t'],
    title,
    summary: `summary of ${title}`,
    body: `body for ${title}`,
    confidence: 'high',
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
            title: `Proposed title ${action}`,
            kind: 'practice',
            tags: ['t'],
            summary: 'Proposed summary',
            body: '# Proposed\n\nBody.',
            confidence: 'high',
            relates_to: [],
          },
    rationale: 'because',
  };
  return { ...base, ...overrides };
}

describe('listPendingSessions', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('returns only proposal_status=done sessions that have not yet been curated', () => {
    seedSession(harness, 'a', [makeCandidate('practice', 'A')], []);
    // pending session — not yet proposal done.
    const fm = {
      schema_version: 1,
      session_id: 'pending',
      captured_by: 'stop',
      captured_at: '2026-05-12T10:00:00Z',
      transcript_hash: 'sha256:pending',
      proposal_status: 'pending',
      proposal_completed_at: null,
      proposal_error: null,
      proposal_log: null,
      proposals: { practice: [], map: [] },
    };
    writeFileSync(join(harness.sessionsDir, 'session-pending.md'), matter.stringify('# x', fm));
    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions.map(s => s.sessionId)).toEqual(['a']);
  });

  it('orders results by captured_at ascending', () => {
    seedSession(harness, 'late', [makeCandidate('practice', 'L')], [], '2026-05-12T12:00:00Z');
    seedSession(harness, 'early', [makeCandidate('practice', 'E')], [], '2026-05-12T08:00:00Z');
    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions.map(s => s.sessionId)).toEqual(['early', 'late']);
  });

  it('skips sessions that have already been stamped curator_processed_at', () => {
    const fname = seedSession(harness, 'done', [makeCandidate('practice', 'D')], []);
    // Stamp it.
    const filePath = join(harness.sessionsDir, fname);
    const parsed = matter(readFileSync(filePath, 'utf8'));
    const data = { ...(parsed.data as Record<string, unknown>) };
    data['curator_processed_at'] = '2026-05-12T11:00:00Z';
    writeFileSync(filePath, matter.stringify(parsed.content, data));

    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions).toEqual([]);
  });
});

describe('dedupActions', () => {
  it('keeps the higher-confidence action when two derive to the same slug', () => {
    const a = makeAction('add', {
      proposed_node: {
        title: 'Foo',
        kind: 'practice',
        tags: [],
        summary: 'low',
        body: 'body',
        confidence: 'low',
        relates_to: [],
      },
    });
    const b = makeAction('add', {
      proposed_node: {
        title: 'Foo',
        kind: 'practice',
        tags: [],
        summary: 'high',
        body: 'body',
        confidence: 'high',
        relates_to: [],
      },
    });
    const merged = dedupActions([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.proposed_node?.summary).toBe('high');
  });

  it('preserves distinct drop actions per candidate_origin', () => {
    const a = makeAction('drop', { candidate_origin: 's:practice:0' });
    const b = makeAction('drop', { candidate_origin: 's:practice:1' });
    expect(dedupActions([a, b])).toHaveLength(2);
  });

  it('treats two actions targeting the same modify target as one', () => {
    const a = makeAction('modify', { target_node_id: 'practice-foo' });
    const b = makeAction('modify', { target_node_id: 'practice-foo' });
    const merged = dedupActions([a, b]);
    expect(merged).toHaveLength(1);
  });
});

describe('markSessionsProcessed', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('stamps curator_processed_at and curator_run_id on each pending session', () => {
    seedSession(harness, 'a', [makeCandidate('practice', 'A')], []);
    const sessions = listPendingSessions(harness.sessionsDir);
    const now = new Date('2026-05-12T11:30:00Z');
    markSessionsProcessed(sessions, 'run-1', now);

    const file = join(harness.sessionsDir, 'session-a.md');
    const parsed = matter(readFileSync(file, 'utf8'));
    const data = parsed.data as Record<string, unknown>;
    expect(data['curator_processed_at']).toBe('2026-05-12T11:30:00.000Z');
    expect(data['curator_run_id']).toBe('run-1');
  });
});

describe('mintConflictId', () => {
  it('produces the deterministic `${runId}-${n}` shape', () => {
    expect(mintConflictId('abc-123', 1)).toBe('abc-123-1');
    expect(mintConflictId('abc-123', 17)).toBe('abc-123-17');
  });
});

describe('ProposalCandidateSchema (strict, hint fields removed)', () => {
  const valid = {
    kind: 'practice' as const,
    tags: ['t'],
    title: 'X',
    summary: 's',
    body: 'b',
    confidence: 'high' as const,
  };

  it('accepts the six-field shape', () => {
    expect(ProposalCandidateSchema.parse(valid)).toMatchObject(valid);
  });

  it.each([
    ['supports_existing_node=null', { supports_existing_node: null }],
    ['supports_existing_node=string', { supports_existing_node: 'practice-x' }],
    ['contradicts_existing_node=string', { contradicts_existing_node: 'practice-x' }],
    ['unknown key', { fancy_new_field: true }],
  ])('rejects %s on a candidate', (_label, extra) => {
    const result = ProposalCandidateSchema.safeParse({ ...valid, ...extra });
    expect(result.success).toBe(false);
  });
});

describe('CuratorProposedNodeSchema (strict, trimmed)', () => {
  const validNode = {
    title: 'X',
    kind: 'practice' as const,
    tags: ['t'],
    summary: 's',
    body: 'b',
    confidence: 'high' as const,
    relates_to: [] as string[],
  };

  it('accepts the seven-field shape', () => {
    expect(CuratorProposedNodeSchema.parse(validNode)).toMatchObject(validNode);
  });

  it.each([
    ['id', { id: 'practice-x' }],
    ['derived_from', { derived_from: ['session-1.md'] }],
    ['unknown', { fancy_new_field: true }],
  ])('rejects %s on proposed_node (strict mode)', (_label, extra) => {
    const result = CuratorProposedNodeSchema.safeParse({ ...validNode, ...extra });
    expect(result.success).toBe(false);
  });

  it('CuratorOutputSchema parse fails when an action embeds id in proposed_node', () => {
    const malformed = [
      {
        action: 'add',
        candidate_origin: 's:practice:0',
        target_node_id: null,
        proposed_node: { ...validNode, id: 'practice-x' },
        rationale: 'r',
      },
    ];
    expect(CuratorOutputSchema.safeParse(malformed).success).toBe(false);
  });
});
