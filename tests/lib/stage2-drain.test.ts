import matter from 'gray-matter';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendToQueue, readQueue } from '../../src/lib/queue.js';
import { renderSessionLog } from '../../src/lib/session-log.js';
import {
  drainStage2Queue,
  STAGE2_LOCK_NAME,
  type Stage2Runner,
} from '../../src/lib/stage2-drain.js';
import { acquireLock, readState } from '../../src/lib/state.js';

interface Harness {
  root: string;
  sessionsDir: string;
  logsDir: string;
  stateFile: string;
  queueFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-drain-'));
  const sessionsDir = join(root, '.ai/knowledge-base/_sessions');
  const logsDir = join(root, '.ai/knowledge-base/_logs');
  const stateFile = join(root, '.ai/.kb-builder/state.json');
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  return { root, sessionsDir, logsDir, stateFile, queueFile: join(sessionsDir, '.queue.json') };
}

function seedSession(harness: Harness, sessionId: string, transcript: string): string {
  const filename = `session-${sessionId}.md`;
  const body = renderSessionLog({
    sessionId,
    capturedBy: 'stop',
    capturedAt: '2026-05-11T10:00:00Z',
    transcriptHash: `sha256:${sessionId}`,
    gitleaksStatus: 'clean',
    body: transcript,
  });
  writeFileSync(join(harness.sessionsDir, filename), body);
  appendToQueue(harness.queueFile, {
    session_id: sessionId,
    session_log: filename,
    captured_by: 'stop',
    captured_at: '2026-05-11T10:00:00Z',
    attempts: 0,
  });
  return filename;
}

const PROMPT_TEMPLATE =
  'Extract knowledge from the following transcript.\n\n[TRANSCRIPT PLACEHOLDER — substituted at runtime]';

function successRunner(): Stage2Runner {
  return async () => ({
    practice: [
      {
        kind: 'practice',
        tags: ['di'],
        title: 'Use DI',
        summary: 'Inject services in constructors',
        body: 'Constructor injection is the convention.',
        confidence: 'high',
        supports_existing_node: null,
        contradicts_existing_node: null,
      },
    ],
    map: [
      {
        kind: 'map',
        tags: ['module'],
        title: 'bravo_insider module',
        summary: 'Personalized section module',
        body: 'Lives at modules/custom/bravo_insider.',
        confidence: 'high',
        supports_existing_node: null,
        contradicts_existing_node: null,
      },
    ],
  });
}

function failingRunner(message: string): Stage2Runner {
  return async () => {
    throw new Error(message);
  };
}

describe('drainStage2Queue', () => {
  let harness: Harness;
  beforeEach(() => {
    harness = makeHarness();
  });
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('processes a queued session log on success and updates frontmatter', async () => {
    const file = seedSession(harness, 's1', '[USER]: use bravo_pii.cache for PII\n[AGENT]: ok');

    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });

    expect(summary.status).toBe('completed');
    expect(summary.processed[0]?.status).toBe('done');
    expect(summary.remaining).toBe(0);

    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['stage_2_status']).toBe('done');
    expect(after.data['stage_2_log']).toMatch(/_logs\/stage-2\//);
    const proposals = after.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);
    expect(proposals.map).toHaveLength(1);
    expect(after.data['topics']).toEqual(expect.arrayContaining(['di', 'module']));
    expect(readQueue(harness.queueFile).entries).toHaveLength(0);
  });

  it('substitutes the transcript into the prompt template before invoking the runner', async () => {
    seedSession(harness, 's-sub', 'TRANSCRIPT-BODY-MARKER');
    let receivedPrompt = '';
    const runner: Stage2Runner = async (prompt, _stdin, _schema, _opts) => {
      receivedPrompt = prompt;
      return { practice: [], map: [] };
    };

    await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });

    expect(receivedPrompt).toContain('TRANSCRIPT-BODY-MARKER');
    expect(receivedPrompt).not.toContain('[TRANSCRIPT PLACEHOLDER');
  });

  it('returns status=locked when another process holds the lock', async () => {
    seedSession(harness, 's2', '[USER]: hi');
    const lockTime = new Date('2026-05-11T10:00:00Z');
    acquireLock(harness.stateFile, {
      name: STAGE2_LOCK_NAME,
      pid: 999_999,
      now: lockTime,
    });

    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
      pid: 12345,
      // Pin "now" inside the lock's TTL so this test is deterministic
      // regardless of wall-clock drift from the fixture timestamp above.
      now: () => new Date(lockTime.getTime() + 60_000),
    });

    expect(summary.status).toBe('locked');
    expect(readQueue(harness.queueFile).entries).toHaveLength(1);
  });

  it('respects maxEntries and leaves remaining entries on the queue', async () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      seedSession(harness, id, `[USER]: hi-${id}`);
    }
    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
      maxEntries: 2,
    });
    expect(summary.processed).toHaveLength(2);
    expect(summary.remaining).toBe(2);
  });

  it('retries a failure (attempts<max) and rotates the entry to the back of the queue', async () => {
    seedSession(harness, 'first', '[USER]: hi-first');
    seedSession(harness, 'second', '[USER]: hi-second');

    let calls = 0;
    const runner: Stage2Runner = async () => {
      calls += 1;
      if (calls === 1) throw new Error('parse error');
      return { practice: [], map: [] };
    };

    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
      maxEntries: 2,
    });
    expect(summary.processed[0]?.status).toBe('failed');
    expect(summary.processed[1]?.status).toBe('done');
    const queueAfter = readQueue(harness.queueFile);
    expect(queueAfter.entries).toHaveLength(1);
    expect(queueAfter.entries[0]?.session_id).toBe('first');
    expect(queueAfter.entries[0]?.attempts).toBe(1);
  });

  it('marks a session log as skipped after the max-attempts threshold', async () => {
    const file = seedSession(harness, 'doomed', '[USER]: hi-doomed');
    // Pre-set attempts to 2 so the first failure here hits the cap.
    const existing = readQueue(harness.queueFile);
    existing.entries[0]!.attempts = 2;
    writeFileSync(harness.queueFile, JSON.stringify(existing, null, 2));

    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: failingRunner('schema mismatch'),
      maxAttempts: 3,
    });

    expect(summary.processed[0]?.status).toBe('skipped');
    expect(readQueue(harness.queueFile).entries).toHaveLength(0);
    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['stage_2_status']).toBe('skipped');
    expect(after.data['stage_2_error']).toContain('schema mismatch');
  });

  it('handles a queue entry whose session log is missing on disk', async () => {
    appendToQueue(harness.queueFile, {
      session_id: 'ghost',
      session_log: 'does-not-exist.md',
      captured_by: 'stop',
      captured_at: '2026-05-11T10:00:00Z',
      attempts: 0,
    });
    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });
    expect(summary.processed[0]?.status).toBe('missing-log');
    expect(readQueue(harness.queueFile).entries).toHaveLength(0);
  });

  it('releases the lock after completion', async () => {
    seedSession(harness, 's3', '[USER]: hi');
    await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });
    expect(readState(harness.stateFile).lock ?? null).toBeNull();
  });

  it('releases the lock even if a runner throws an unexpected error', async () => {
    seedSession(harness, 's4', '[USER]: hi');
    await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: failingRunner('boom'),
    });
    expect(readState(harness.stateFile).lock ?? null).toBeNull();
  });

  it('does nothing and reports remaining=0 when the queue is empty', async () => {
    const summary = await drainStage2Queue({
      sessionsDir: harness.sessionsDir,
      logsDir: harness.logsDir,
      stateFile: harness.stateFile,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });
    expect(summary.processed).toHaveLength(0);
    expect(summary.remaining).toBe(0);
    expect(existsSync(harness.logsDir)).toBe(true);
  });
});
