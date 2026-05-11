import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateIndex, writeIndex } from '../../src/lib/index-gen.js';
import {
  DEFAULT_NUDGE_THRESHOLD,
  buildSessionStartContext,
  countPendingSessions,
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

function seedSession(harness: Harness, sessionId: string, processed: boolean): void {
  const fm: Record<string, unknown> = {
    schema_version: 1,
    session_id: sessionId,
    captured_by: 'stop',
    captured_at: '2026-05-11T10:00:00Z',
    transcript_hash: `sha256:${sessionId}`,
    stage_2_status: 'done',
    stage_2_completed_at: '2026-05-11T10:00:01Z',
    stage_2_error: null,
    stage_2_log: null,
    gitleaks_status: 'clean',
    topics: [],
    proposals: { practice: [], map: [] },
  };
  if (processed) fm['curator_processed_at'] = '2026-05-11T11:00:00Z';
  writeFileSync(
    join(harness.sessionsDir, `session-${sessionId}.md`),
    matter.stringify('## body\n', fm),
  );
}

function seedNode(harness: Harness, kind: 'practice' | 'map', id: string): void {
  const fm = {
    schema_version: 1,
    id,
    title: id,
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

  it('counts stage-2-done sessions not yet curated', () => {
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
    expect(result.additionalContext).not.toContain('stale');
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

  it('preserves an existing lock when persisting last_nudged_at', () => {
    for (let i = 0; i < DEFAULT_NUDGE_THRESHOLD; i += 1) seedSession(harness, `s-${i}`, false);
    writeState(harness.stateFile, {
      schema_version: 1,
      lock: {
        name: 'curator',
        pid: 1234,
        acquired_at: '2026-05-11T09:00:00Z',
        ttl_ms: 1_800_000,
      },
    });
    buildSessionStartContext({
      kbDir: harness.kbDir,
      nodesDir: harness.nodesDir,
      sessionsDir: harness.sessionsDir,
      stateFile: harness.stateFile,
      now: () => new Date('2026-05-11T10:00:00Z'),
    });
    const state = readState(harness.stateFile);
    expect(state.lock?.name).toBe('curator');
    expect(state.lock?.pid).toBe(1234);
    expect(typeof state.last_nudged_at).toBe('string');
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
