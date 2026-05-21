import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateIndex, writeIndex } from '../../src/lib/index-gen.js';
import {
  DEFAULT_NUDGE_THRESHOLD,
  DEFAULT_STALE_DAYS,
  buildSessionStartContext,
  countPendingSessions,
  summarizePendingSessions,
} from '../../src/lib/session-start.js';
import { writeState, readState } from '../../src/lib/state.js';

interface Harness {
  root: string;
  kbDir: string;
  nodesDir: string;
  sessionsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-session-start-'));
  const kbDir = join(root, '.ai/knowledge-base');
  const nodesDir = join(kbDir, 'nodes');
  const sessionsDir = join(kbDir, '_sessions');
  const stateFile = join(root, '.ai/knowledge-base/.state/state.json');
  mkdirSync(join(nodesDir, 'practice'), { recursive: true });
  mkdirSync(join(nodesDir, 'map'), { recursive: true });
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return { root, kbDir, nodesDir, sessionsDir, stateFile };
}

interface SeedOptions {
  capturedAt?: string;
  practiceCount?: number;
  mapCount?: number;
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
    proposal_status: 'done',
    proposal_completed_at: capturedAt,
    proposal_error: null,
    proposal_log: null,
    secret_scan_status: 'clean',
    proposals: { practice, map },
  };
  if (processed) fm['curator_processed_at'] = '2026-05-11T11:00:00Z';
  writeFileSync(
    join(harness.sessionsDir, `session-${sessionId}.md`),
    matter.stringify('## body\n', fm)
  );
}

function seedMalformedSession(harness: Harness, sessionId: string): void {
  writeFileSync(
    join(harness.sessionsDir, `session-${sessionId}.md`),
    '---\nnot: valid frontmatter\n---\n## body\n'
  );
}

function seedNode(harness: Harness, kind: 'practice' | 'map', id: string): void {
  const fm = {
    schema_version: 1,
    id,
    title: id,
    kind,
    tags: [],
    derived_from: [],
    relates_to: [],
    confidence: 'high',
    summary: 's',
  };
  writeFileSync(join(harness.nodesDir, kind, `${id}.md`), matter.stringify(`# ${id}\nBody.`, fm));
}

function writeIndexFromCurrentNodes(harness: Harness): void {
  const idx = generateIndex(harness.nodesDir);
  mkdirSync(harness.kbDir, { recursive: true });
  writeIndex(join(harness.kbDir, 'INDEX.md'), idx);
}

describe('countPendingSessions', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('counts proposal-done sessions not yet curated', () => {
    seedSession(harness, 'a', false);
    seedSession(harness, 'b', false);
    seedSession(harness, 'c', true);
    expect(countPendingSessions(harness.sessionsDir)).toBe(2);
  });

  it('returns 0 for a missing sessions directory', () => {
    expect(countPendingSessions(join(harness.root, 'missing'))).toBe(0);
  });
});

describe('buildSessionStartContext', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('emits a stub when INDEX.md is missing', () => {
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexMissing).toBe(true);
    expect(result.additionalContext).toContain('# KB Index');
    expect(result.additionalContext).toContain('empty');
  });

  it('appends the verification footer on every session-start payload', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.additionalContext).toContain('KB nodes are snapshots in time');
  });

  it('emits the KB navigation directive in the additional context payload', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.additionalContext).toContain('grep -C 2');
    expect(result.additionalContext).toContain('nodes/');
  });

  it('injects the live INDEX.md when fresh and emits no warnings', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexStale).toBe(false);
    expect(result.indexMissing).toBe(false);
    expect(result.additionalContext).toContain('practice-foo');
    expect(result.additionalContext).not.toContain('KB index is stale');
    expect(result.additionalContext).not.toContain('pending session log');
  });

  it('appends a stale warning when nodes/ has drifted from INDEX.md', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    // Drift: add another node so the live nodes_hash no longer matches.
    seedNode(harness, 'map', 'map-bar');
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    expect(result.indexStale).toBe(true);
    expect(result.additionalContext).toContain('KB index is stale');
  });

  it('appends a nudge when pending >= threshold and updates last_nudged_at', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) seedSession(harness, `s-${i}`, false);
    const now = new Date('2026-05-11T10:00:00Z');
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => now,
    });
    expect(result.nudged).toBe(true);
    expect(result.additionalContext).toContain(`${DEFAULT_NUDGE_THRESHOLD} pending session log(s)`);
    const state = readState(harness.stateFile);
    expect(state.last_nudged_at).toBe(now.toISOString());
  });

  it('respects the hourly throttle (no nudge within 1 hour of last_nudged_at)', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) seedSession(harness, `s-${i}`, false);
    writeState(harness.stateFile, {
      schema_version: 1,
      last_nudged_at: '2026-05-11T10:00:00Z',
    });
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T10:30:00Z'), // 30 minutes later
    });
    expect(result.nudged).toBe(false);
    expect(result.additionalContext).not.toContain('pending session log');
  });

  it('re-nudges after the throttle elapses', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) seedSession(harness, `s-${i}`, false);
    writeState(harness.stateFile, {
      schema_version: 1,
      last_nudged_at: '2026-05-11T10:00:00Z',
    });
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T11:30:00Z'), // 90 minutes later
    });
    expect(result.nudged).toBe(true);
  });

  it('does not nudge when below threshold', () => {
    seedSession(harness, 'just-one', false);
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      threshold: 5,
    });
    expect(result.nudged).toBe(false);
    expect(result.pendingSessions).toBe(1);
  });

  it('renders soft form when at threshold and oldest is today', () => {
    const today = '2026-05-11T08:00:00Z';
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) {
      seedSession(harness, `s-${i}`, false, {
        capturedAt: today,
        practiceCount: 1,
        mapCount: 1,
      });
    }
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T20:00:00Z'),
    });
    expect(result.nudged).toBe(true);
    expect(result.additionalContext).not.toContain('KB curation queue is overdue');
    expect(result.additionalContext).toContain(
      `${DEFAULT_NUDGE_THRESHOLD} pending session log(s), ${DEFAULT_NUDGE_THRESHOLD * 2} candidate proposal(s), captured today`
    );
    expect(result.additionalContext).toContain(
      'Run `/kb-curate` (or `npx @e0ipso/ai-knowledge-base curate`)'
    );
  });

  it('renders loud form when oldest pending is at or beyond staleDays', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) {
      seedSession(harness, `s-${i}`, false, {
        capturedAt: '2026-05-03T10:00:00Z', // 8 days before "now"
        practiceCount: 2,
      });
    }
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T10:00:00Z'),
    });
    expect(result.nudged).toBe(true);
    expect(result.additionalContext).toContain('KB curation queue is overdue');
    expect(result.additionalContext).toContain('oldest pending: 8 day(s)');
    expect(result.additionalContext).toContain(
      `${DEFAULT_NUDGE_THRESHOLD} pending session log(s), ${DEFAULT_NUDGE_THRESHOLD * 2} candidate proposal(s)`
    );
  });

  it('renders loud form via the 2x threshold path even when all are fresh', () => {
    const today = '2026-05-11T09:00:00Z';
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD * 2; i += 1) {
      seedSession(harness, `s-${i}`, false, { capturedAt: today, mapCount: 1 });
    }
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T20:00:00Z'),
    });
    expect(result.nudged).toBe(true);
    expect(result.additionalContext).toContain('KB curation queue is overdue');
    expect(result.additionalContext).toContain('captured today');
    expect(result.additionalContext).toContain(
      `${DEFAULT_NUDGE_THRESHOLD * 2} pending session log(s)`
    );
  });

  it('throttle suppresses loud form when last_nudged_at is recent', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) {
      seedSession(harness, `s-${i}`, false, { capturedAt: '2026-05-03T10:00:00Z' });
    }
    writeState(harness.stateFile, {
      schema_version: 1,
      last_nudged_at: '2026-05-11T09:30:00Z', // 30 min before "now"
    });
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T10:00:00Z'),
    });
    expect(result.nudged).toBe(false);
    expect(result.additionalContext).not.toContain('KB curation queue is overdue');
    expect(result.additionalContext).not.toContain('pending session log');
  });

  it('still emits the soft nudge when one session log is malformed', () => {
    const today = '2026-05-11T09:00:00Z';
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) {
      seedSession(harness, `s-${i}`, false, { capturedAt: today, practiceCount: 1 });
    }
    seedMalformedSession(harness, 'broken');
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T20:00:00Z'),
    });
    expect(result.nudged).toBe(true);
    expect(result.pendingSessions).toBe(DEFAULT_NUDGE_THRESHOLD);
    expect(result.additionalContext).toContain(
      `${DEFAULT_NUDGE_THRESHOLD} pending session log(s), ${DEFAULT_NUDGE_THRESHOLD} candidate proposal(s)`
    );
    expect(result.additionalContext).not.toContain('KB curation queue is overdue');
  });
});

describe('summarizePendingSessions', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

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

  it('returns zeroes for an empty directory', () => {
    const summary = summarizePendingSessions(harness.sessionsDir);
    expect(summary).toEqual({ pending: 0, candidateCount: 0, oldestCapturedAt: null });
  });
});

describe('DEFAULT_STALE_DAYS', () => {
  it('is 7 days', () => {
    expect(DEFAULT_STALE_DAYS).toBe(7);
  });
});

describe('buildSessionStartContext lint nudge', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('omits the lint nudge when lint-state reports zero errors and zero findings', () => {
    const lintStateFile = join(harness.root, '.ai/knowledge-base/.state/lint-state.json');
    mkdirSync(dirname(lintStateFile), { recursive: true });
    writeFileSync(
      lintStateFile,
      JSON.stringify({
        schema_version: 1,
        sessions_since_last_lint: 0,
        last_lint_at: '2026-05-13T10:00:00Z',
        last_errors: 0,
        last_findings: 0,
      })
    );
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      lintStateFile,
    });
    expect(result.lintNudged).toBe(false);
    expect(result.additionalContext).not.toMatch(/Last KB lint/);
  });

  it('appends a lint summary line and sets lintNudged when counts are non-zero', () => {
    const lintStateFile = join(harness.root, '.ai/knowledge-base/.state/lint-state.json');
    mkdirSync(dirname(lintStateFile), { recursive: true });
    writeFileSync(
      lintStateFile,
      JSON.stringify({
        schema_version: 1,
        sessions_since_last_lint: 0,
        last_lint_at: '2026-05-13T10:00:00Z',
        last_errors: 2,
        last_findings: 1,
      })
    );
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      lintStateFile,
    });
    expect(result.lintNudged).toBe(true);
    expect(result.additionalContext).toMatch(/Last KB lint .* 2 error\(s\), 1 finding\(s\)/);
  });
});

describe('buildSessionStartContext additionalContext shape', () => {
  let harness: Harness;
  beforeEach(() => (harness = makeHarness()));
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('strips the INDEX frontmatter before injection', () => {
    seedNode(harness, 'practice', 'practice-foo');
    writeIndexFromCurrentNodes(harness);
    // Make sure the raw file has frontmatter.
    const raw = readFileSync(join(harness.kbDir, 'INDEX.md'), 'utf8');
    expect(raw).toMatch(/^---\n/);
    const result = buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
    });
    // The injected content is the body, no YAML frontmatter.
    expect(result.additionalContext.startsWith('---')).toBe(false);
    expect(result.additionalContext).toContain('# KB Index');
  });
});
