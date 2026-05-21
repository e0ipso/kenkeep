import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BATCH_PLACEHOLDER,
  buildBatchPayload,
  buildBatchPrompt,
  dedupActions,
  listPendingSessions,
  runCurate,
  type CuratorBatchPayload,
  type CuratorRunner,
} from '../../src/lib/curate.js';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import type { CuratorAction, NodeFrontmatter, ProposalCandidate } from '../../src/lib/schemas.js';
import {
  CuratorOutputSchema,
  CuratorProposedNodeSchema,
  ProposalCandidateSchema,
} from '../../src/lib/schemas.js';
import { STATE_LOCK_OPTIONS } from '../../src/lib/state.js';

interface Harness {
  root: string;
  paths: RepoPaths;
  kbDir: string;
  sessionsDir: string;
  nodesDir: string;
  logsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-curate-'));
  const paths = repoPaths(root);
  const stateFile = join(paths.stateDir, 'state.json');
  mkdirSync(paths.sessionsDir, { recursive: true });
  mkdirSync(paths.nodesDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  return {
    root,
    paths,
    kbDir: paths.kbDir,
    sessionsDir: paths.sessionsDir,
    nodesDir: paths.nodesDir,
    logsDir: paths.logsDir,
    stateFile,
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
    secret_scan_status: 'clean',
    proposals: { practice, map },
  };
  const body = matter.stringify('## Proposal\n', fm);
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
    derived_from: [],
    relates_to: [],
    confidence: 'high',
    summary: 'existing summary',
  };
  writeFileSync(join(dir, `${id}.md`), matter.stringify(body, fm));
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

const PROMPT_TEMPLATE = 'You are the curator.\n\n[BATCH PLACEHOLDER, substituted at runtime]';

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
      secret_scan_status: 'clean',
      proposals: { practice: [], map: [] },
    };
    writeFileSync(join(harness.sessionsDir, 'session-pending.md'), matter.stringify('# x', fm));
    const sessions = listPendingSessions(harness.sessionsDir);
    expect(sessions.map(s => s.sessionId)).toEqual(['a']);
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
});

describe('runCurate', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  function ctx(runner: CuratorRunner) {
    return {
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    };
  }

  it('writes a node per add action and marks the session as processed', async () => {
    seedSession(harness, 's1', [makeCandidate('practice', 'Use X')], []);
    const runner: CuratorRunner = async () => [
      makeAction('add', {
        candidate_origin: 's1:practice:0',
        proposed_node: {
          title: 'Use X',
          kind: 'practice',
          tags: ['x'],
          summary: 'Use X everywhere',
          body: '# Use X\nBody.\n',
          confidence: 'high',
          relates_to: [],
        },
      }),
    ];

    const result = await runCurate(ctx(runner));

    expect(result.status).toBe('completed');
    expect(result.nodesWritten).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toBe(0);
    const nodeFile = join(harness.nodesDir, 'practice', 'practice-use-x.md');
    expect(existsSync(nodeFile)).toBe(true);
    // Frontmatter is the pure node shape — no `proposal:` block.
    const fm = matter(readFileSync(nodeFile, 'utf8')).data as Record<string, unknown>;
    expect(fm).not.toHaveProperty('proposal');
    expect(fm['id']).toBe('practice-use-x');
    expect((fm as NodeFrontmatter).title).toBe('Use X');
    // derived_from synthesized from candidate_origin -> session filename.
    expect((fm as NodeFrontmatter).derived_from).toEqual(['session-s1.md']);
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
          title: 'Modified Title',
          kind: 'practice',
          tags: ['m'],
          summary: 'merged summary',
          body: '# Merged\nUpdated body.\n',
          confidence: 'high',
          relates_to: [],
        },
      }),
      makeAction('contradict', { target_node_id: 'practice-contra-target' }),
    ];

    const result = await runCurate(ctx(runner));

    expect(result.nodesWritten).toBe(1);
    expect(result.conflicts).toBe(1);
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
    // The conflict markdown file was written.
    const conflictFiles = existsSync(harness.paths.conflictsDir)
      ? readdirSync(harness.paths.conflictsDir)
      : [];
    expect(conflictFiles).toHaveLength(1);
    const conflictBody = readFileSync(join(harness.paths.conflictsDir, conflictFiles[0]!), 'utf8');
    const parsedConflict = matter(conflictBody);
    expect((parsedConflict.data as Record<string, unknown>).target_node_id).toBe(
      'practice-contra-target'
    );
    expect(parsedConflict.content).toContain('## Rationale');
    expect(parsedConflict.content).toContain('because');
  });

  it('writes a per-conflict markdown file with the documented frontmatter and body', async () => {
    seedExistingNode(harness, 'practice', 'practice-target', '# orig\n');
    seedSession(harness, 's', [makeCandidate('practice', 'X')], []);
    const runner: CuratorRunner = async () => [
      makeAction('contradict', {
        candidate_origin: '_sessions/session-s.md:practice:0',
        target_node_id: 'practice-target',
        rationale: 'The user reversed the earlier decision.',
        proposed_node: {
          title: 'New practice title',
          kind: 'practice',
          tags: ['t'],
          summary: 'new summary',
          body: '# New practice\n\nThe new rule.\n',
          confidence: 'high',
          relates_to: [],
        },
      }),
    ];

    const result = await runCurate(ctx(runner));

    expect(result.conflicts).toBe(1);
    const files = readdirSync(harness.paths.conflictsDir);
    expect(files).toHaveLength(1);
    const file = files[0]!;
    expect(file).toMatch(new RegExp(`^${result.runId}-1\\.md$`));
    const parsed = matter(readFileSync(join(harness.paths.conflictsDir, file), 'utf8'));
    const fm = parsed.data as Record<string, unknown>;
    expect(fm['id']).toBe(`${result.runId}-1`);
    expect(fm['status']).toBe('pending');
    expect(fm['run_id']).toBe(result.runId);
    expect(fm['candidate_origin']).toBe('_sessions/session-s.md:practice:0');
    expect(fm['target_node_id']).toBe('practice-target');
    expect(fm['proposed_kind']).toBe('practice');
    expect(fm['proposed_title']).toBe('New practice title');
    expect(fm['proposed_confidence']).toBe('high');
    expect(typeof fm['detected_at']).toBe('string');
    expect(parsed.content).toContain('## Rationale');
    expect(parsed.content).toContain('The user reversed the earlier decision.');
    expect(parsed.content).toContain('## Proposed node');
    expect(parsed.content).toContain('The new rule.');
  });

  it('add against an existing node is a fail-loud failure (no overwrite)', async () => {
    seedExistingNode(harness, 'practice', 'practice-collide', '# pre-existing\n');
    seedSession(harness, 's', [makeCandidate('practice', 'C')], []);
    const runner: CuratorRunner = async () => [
      makeAction('add', {
        proposed_node: {
          title: 'collide',
          kind: 'practice',
          tags: [],
          summary: 'new',
          body: '# overwrite-attempt\n',
          confidence: 'high',
          relates_to: [],
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
          title: 'Phantom',
          kind: 'practice',
          tags: [],
          summary: 's',
          body: 'body',
          confidence: 'high',
          relates_to: [],
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
    mkdirSync(join(harness.paths.stateDir), { recursive: true });
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    try {
      const result = await runCurate(ctx(async () => []));
      expect(result.status).toBe('locked');
    } finally {
      await release();
    }
  });

  it('releases the lock after completion', async () => {
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    await runCurate(ctx(async () => []));
    // A fresh lock acquisition must succeed after runCurate returns.
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    await release();
  });

  it('fires onBatchStart and onBatchEnd for each batch, and threads onCuratorMessage to the runner', async () => {
    seedSession(harness, 's1', [makeCandidate('practice', 'A')], []);
    seedSession(harness, 's2', [makeCandidate('practice', 'B')], [], '2026-05-12T10:01:00Z');
    const starts: Array<{ index: number; total: number; size: number }> = [];
    const ends: Array<{ index: number; total: number }> = [];
    let runnerSawOnMessage = false;
    const runner: CuratorRunner = async (_p, _s, _schema, runnerOpts) => {
      if (typeof runnerOpts.onMessage === 'function') {
        runnerSawOnMessage = true;
        runnerOpts.onMessage({ type: 'assistant' });
      }
      return [];
    };
    const sink: unknown[] = [];
    await runCurate({
      ...ctx(runner),
      onBatchStart: ({ index, total, batch }) => starts.push({ index, total, size: batch.length }),
      onBatchEnd: ({ index, total }) => ends.push({ index, total }),
      onCuratorMessage: msg => sink.push(msg),
    });
    // Two sessions fit in a single batch (CURATE_BATCH_SIZE = 10).
    expect(starts).toEqual([{ index: 0, total: 1, size: 2 }]);
    expect(ends.map(e => e.index)).toEqual([0]);
    expect(runnerSawOnMessage).toBe(true);
    expect(sink).toEqual([{ type: 'assistant' }]);
  });

  it('splits 21 pending sessions into 3 batches via chunk(sessions, 10)', async () => {
    for (let i = 0; i < 21; i += 1) {
      const id = `s${String(i).padStart(2, '0')}`;
      seedSession(
        harness,
        id,
        [makeCandidate('practice', `Title ${id}`)],
        [],
        `2026-05-12T10:${String(i).padStart(2, '0')}:00Z`
      );
    }
    const starts: Array<{ index: number; total: number; size: number }> = [];
    const runner: CuratorRunner = async () => [];
    const result = await runCurate({
      ...ctx(runner),
      onBatchStart: ({ index, total, batch }) => starts.push({ index, total, size: batch.length }),
    });
    expect(result.status).toBe('completed');
    expect(starts.map(s => s.size)).toEqual([10, 10, 1]);
    expect(starts.every(s => s.total === 3)).toBe(true);
  });

  it('forwards harnessOpts to the runner when set, omits them otherwise', async () => {
    seedSession(harness, 's-mod', [makeCandidate('practice', 'A')], []);
    let captured: Record<string, unknown> | undefined;
    const runner: CuratorRunner = async (_p, _s, _schema, opts) => {
      captured = opts.harnessOpts;
      return [];
    };
    await runCurate({
      ...ctx(runner),
      harnessOpts: { model: 'opus', effort: 'max', allowedTools: ['Read'] },
    });
    expect(captured).toEqual({ model: 'opus', effort: 'max', allowedTools: ['Read'] });

    seedSession(harness, 's-nomod', [makeCandidate('practice', 'B')], [], '2026-05-12T10:02:00Z');
    captured = undefined;
    await runCurate(ctx(runner));
    expect(captured).toBeUndefined();
  });

  it('reports no-pending and still regenerates INDEX/GRAPH when nothing is queued', async () => {
    const result = await runCurate(ctx(async () => []));
    expect(result.status).toBe('no-pending');
    expect(result.failures).toEqual([]);
    expect(result.conflicts).toBe(0);
    expect(existsSync(join(harness.kbDir, 'INDEX.md'))).toBe(true);
  });

  it('buildBatchPayload always emits an empty existing_nodes array', () => {
    seedExistingNode(harness, 'practice', 'practice-x');
    seedSession(harness, 's', [makeCandidate('practice', 'Hi')], []);
    const sessions = listPendingSessions(harness.sessionsDir);
    const payload = buildBatchPayload(sessions);
    expect(payload.existing_nodes).toEqual([]);
    expect(payload.batch[0]?.session_id).toBe('s');
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

describe('buildBatchPrompt', () => {
  const emptyPayload: CuratorBatchPayload = {
    existing_nodes: [],
    batch: [],
  };

  it('substitutes the batch placeholder when present', () => {
    const out = buildBatchPrompt(`prefix ${BATCH_PLACEHOLDER} suffix`, emptyPayload);
    expect(out).toContain('prefix');
    expect(out).toContain('suffix');
    expect(out).not.toContain(BATCH_PLACEHOLDER);
    expect(out).toContain('"existing_nodes": []');
  });

  it('throws when the placeholder is missing, naming the placeholder and the curator prompt', () => {
    expect(() => buildBatchPrompt('no placeholder here', emptyPayload)).toThrowError(
      new RegExp(
        `curator prompt is missing the ${BATCH_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      )
    );
  });
});
