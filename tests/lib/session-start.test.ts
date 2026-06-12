import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateIndex, writeIndex } from '../../src/lib/index-gen.js';
import { SessionLogFrontmatterSchema } from '../../src/lib/schemas.js';
import {
  DEFAULT_NUDGE_THRESHOLD,
  KK_NAVIGATION_DIRECTIVE,
  buildSessionStartContext,
  countPendingSessions,
  summarizePendingSessions,
} from '../../src/lib/session-start.js';
import { readState } from '../../src/lib/state.js';

/** Count non-overlapping occurrences of a substring. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// Session-start is the critical path: it injects the INDEX into every new
// session and nudges curation when the queue grows. These tests assert the
// index-injection states (missing/fresh/stale, frontmatter stripped) and the
// pending-count + nudge behavior. Narrow render-form variants (soft vs loud
// wording, lint summary) are intentionally not exercised here.

interface Harness {
  root: string;
  kkDir: string;
  nodesDir: string;
  sessionsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kk-session-start-'));
  const kkDir = join(root, '.ai/kenkeep');
  const nodesDir = join(kkDir, 'nodes');
  const sessionsDir = join(kkDir, '_sessions');
  const stateFile = join(root, '.ai/kenkeep/.state/state.json');
  mkdirSync(join(nodesDir, 'practice'), { recursive: true });
  mkdirSync(join(nodesDir, 'map'), { recursive: true });
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return { root, kkDir, nodesDir, sessionsDir, stateFile };
}

interface SeedOptions {
  capturedAt?: string;
  practiceCount?: number;
  mapCount?: number;
  proposalStatus?: string;
}

function seedSession(
  harness: Harness,
  sessionId: string,
  processed: boolean,
  opts: SeedOptions = {}
): void {
  const capturedAt = opts.capturedAt ?? '2026-05-11T10:00:00Z';
  const practice = Array.from({ length: opts.practiceCount ?? 0 }, (_, i) => ({ idx: i }));
  const map = Array.from({ length: opts.mapCount ?? 0 }, (_, i) => ({ idx: i }));
  const fm: Record<string, unknown> = {
    schema_version: 1,
    session_id: sessionId,
    captured_by: 'stop',
    captured_at: capturedAt,
    transcript_hash: `sha256:${sessionId}`,
    proposal_status: opts.proposalStatus ?? 'done',
    proposal_completed_at: capturedAt,
    proposal_error: null,
    proposal_log: null,
    proposals: { practice, map },
  };
  if (processed) fm['curator_processed_at'] = '2026-05-11T11:00:00Z';
  writeFileSync(
    join(harness.sessionsDir, `session-${sessionId}.md`),
    matter.stringify('## body\n', fm)
  );
}

// Leaves live directly under nodes/ (topical tree; placement is not keyed by
// kind).
function seedNode(harness: Harness, kind: 'practice' | 'map', id: string): void {
  const fm = {
    schema_version: 2,
    id,
    title: id,
    kind,
    tags: [],
    derived_from: [],
    relates_to: [],
    confidence: 'high',
    summary: 's',
  };
  mkdirSync(harness.nodesDir, { recursive: true });
  writeFileSync(join(harness.nodesDir, `${id}.md`), matter.stringify(`# ${id}\nBody.`, fm));
}

// Mirrors `index rebuild`: the entry catalog at .ai/kenkeep/ENTRY.md is the
// whole-tree launchpad body that SessionStart injects.
function writeIndexFromCurrentNodes(harness: Harness): void {
  const idx = generateIndex(harness.nodesDir);
  mkdirSync(harness.kkDir, { recursive: true });
  writeIndex(join(harness.kkDir, 'ENTRY.md'), idx.rootCatalog);
}

describe('buildSessionStartContext (index injection)', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('emits a stub when ENTRY.md is missing', () => {
    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexMissing).toBe(true);
    expect(result.additionalContext).toContain('# kenkeep');
    expect(result.additionalContext).toContain('empty');
  });

  it('injects the live ENTRY.md (frontmatter stripped) when fresh and emits no warnings', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    const raw = readFileSync(join(harness.kkDir, 'ENTRY.md'), 'utf8');
    expect(raw).toMatch(/^---\n/);

    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexStale).toBe(false);
    expect(result.indexMissing).toBe(false);
    expect(result.additionalContext.startsWith('---')).toBe(false);
    expect(result.additionalContext).toContain('# kenkeep');
    expect(result.additionalContext).toContain('practice-foo');
    expect(result.additionalContext).not.toContain('kenkeep index is stale');
    expect(result.additionalContext).not.toContain('pending session log');
  });

  it('injects the descent directive exactly once when ENTRY.md already embeds it', () => {
    // Task 2 embeds the directive in the generated ENTRY.md body. The hook must
    // therefore NOT append it again (Success Criterion 8: exactly one occurrence).
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    const entry = readFileSync(join(harness.kkDir, 'ENTRY.md'), 'utf8');
    expect(entry).toContain(KK_NAVIGATION_DIRECTIVE); // precondition: body embeds it

    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(countOccurrences(result.additionalContext, KK_NAVIGATION_DIRECTIVE)).toBe(1);
  });

  it('bridges a legacy INDEX.md body (no embedded directive) by appending it exactly once', () => {
    // A repo seeded before the ENTRY.md rename and not yet rebuilt: the old
    // INDEX.md body does NOT embed the directive, so the hook appends it once.
    mkdirSync(harness.kkDir, { recursive: true });
    writeFileSync(
      join(harness.kkDir, 'INDEX.md'),
      matter.stringify('# kenkeep\n\nLegacy catalog body without the directive.\n', {
        schema_version: 2,
        nodes_hash: 'sha256:legacy',
        node_count: 0,
      })
    );
    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(countOccurrences(result.additionalContext, KK_NAVIGATION_DIRECTIVE)).toBe(1);
  });

  it('appends a stale warning when nodes/ has drifted from ENTRY.md', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    // Drift: add another node so the live nodes_hash no longer matches.
    seedNode(harness, 'map', 'map-bar');
    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexStale).toBe(true);
    expect(result.additionalContext).toContain('kenkeep index is stale');
  });
});

describe('buildSessionStartContext (curation nudge)', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('appends a nudge at/above threshold and records last_nudged_at', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) seedSession(harness, `s-${i}`, false);
    const now = new Date('2026-05-11T10:00:00Z');
    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => now,
    });
    expect(result.nudged).toBe(true);
    expect(result.additionalContext).toContain(`${DEFAULT_NUDGE_THRESHOLD} pending session log(s)`);
    expect(readState(harness.stateFile).last_nudged_at).toBe(now.toISOString());
  });

  it('does not nudge below threshold', () => {
    seedSession(harness, 'just-one', false);
    const result = buildSessionStartContext({
      kkDir: harness.kkDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      threshold: 5,
    });
    expect(result.nudged).toBe(false);
    expect(result.pendingSessions).toBe(1);
  });
});

describe('pending-session accounting', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('counts proposal-done sessions not yet curated', () => {
    seedSession(harness, 'a', false);
    seedSession(harness, 'b', false);
    seedSession(harness, 'c', true);
    expect(countPendingSessions(harness.sessionsDir)).toBe(2);
  });

  it('aggregates candidate counts across pending sessions and ignores processed ones', () => {
    seedSession(harness, 'a', false, {
      capturedAt: '2026-05-05T10:00:00Z',
      practiceCount: 2,
      mapCount: 1,
    });
    seedSession(harness, 'b', false, {
      capturedAt: '2026-05-08T10:00:00Z',
      practiceCount: 0,
      mapCount: 3,
    });
    seedSession(harness, 'c', true, {
      capturedAt: '2026-05-01T10:00:00Z',
      practiceCount: 10,
      mapCount: 10,
    });
    const summary = summarizePendingSessions(harness.sessionsDir);
    expect(summary.pending).toBe(2);
    expect(summary.candidateCount).toBe(6);
    expect(summary.oldestCapturedAt?.toISOString()).toBe('2026-05-05T10:00:00.000Z');
  });

  it('excludes skipped and failed sessions from the pending queue by status, not by schema failure', () => {
    // 'skipped' is a valid schema status (cursory-session pre-filter); it must
    // parse cleanly and stay out of the queue via the status filter so it
    // remains visible to consumers like `status` rather than being dropped as
    // an unreadable file.
    seedSession(harness, 'skip', false, { proposalStatus: 'skipped' });
    seedSession(harness, 'fail', false, { proposalStatus: 'failed' });
    seedSession(harness, 'live', false, { practiceCount: 1 });

    // The skipped log must be schema-valid (not invisible-by-parse-failure).
    const skippedRaw = matter(
      readFileSync(join(harness.sessionsDir, 'session-skip.md'), 'utf8')
    ).data;
    expect(SessionLogFrontmatterSchema.safeParse(skippedRaw).success).toBe(true);

    const summary = summarizePendingSessions(harness.sessionsDir);
    expect(summary.pending).toBe(1);
    expect(summary.candidateCount).toBe(1);
  });
});
