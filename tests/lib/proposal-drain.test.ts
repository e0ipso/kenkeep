import matter from 'gray-matter';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import { renderSessionLog } from '../../src/lib/session-log.js';
import { drainProposalQueue, type ProposalRunner } from '../../src/lib/proposal-drain.js';
import { STATE_LOCK_OPTIONS } from '../../src/lib/state.js';

// The proposal-drain engine is custom business logic with no integration-level
// coverage: the spawned `kk-proposal-drain` hook returns early in every
// testable harness path (Claude returns immediately; other harnesses require a
// real `agent`/`codex` binary on PATH that the fixtures do not provide). These
// tests drive the engine directly with a fake runner to assert queue
// processing, status filtering, failure handling, locking, and the cap.

interface Harness {
  root: string;
  paths: RepoPaths;
  sessionsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kk-drain-'));
  const paths = repoPaths(root);
  mkdirSync(paths.sessionsDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  return {
    root,
    paths,
    sessionsDir: paths.sessionsDir,
    stateFile: join(paths.stateDir, 'state.json'),
  };
}

function seedSession(harness: Harness, sessionId: string, transcript: string): string {
  const filename = `session-${sessionId}.md`;
  writeFileSync(
    join(harness.sessionsDir, filename),
    renderSessionLog({
      sessionId,
      capturedBy: 'stop',
      capturedAt: '2026-05-11T10:00:00Z',
      transcriptHash: `sha256:${sessionId}`,
      secretScanStatus: 'clean',
      body: transcript,
    })
  );
  return filename;
}

function seedSessionWithStatus(
  harness: Harness,
  sessionId: string,
  status: 'done' | 'failed'
): string {
  const filename = seedSession(harness, sessionId, '[USER]: hi');
  const filePath = join(harness.sessionsDir, filename);
  const parsed = matter(readFileSync(filePath, 'utf8'));
  const data = { ...(parsed.data as Record<string, unknown>) };
  data['proposal_status'] = status;
  writeFileSync(filePath, matter.stringify(parsed.content, data));
  return filename;
}

const PROMPT_TEMPLATE =
  'Extract knowledge from the following transcript.\n\n[TRANSCRIPT PLACEHOLDER, substituted at runtime]';

function successRunner(): ProposalRunner {
  return async () => ({
    practice: [
      {
        kind: 'practice',
        tags: ['di'],
        title: 'Use DI',
        summary: 'Inject services in constructors',
        body: 'Constructor injection is the convention.',
        confidence: 'high',
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
      },
    ],
  });
}

describe('drainProposalQueue', () => {
  let harness: Harness;
  beforeEach(() => {
    harness = makeHarness();
  });
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('processes a pending log on success, substitutes the transcript, and updates frontmatter', async () => {
    const file = seedSession(harness, 's1', 'TRANSCRIPT-BODY-MARKER');
    let receivedPrompt = '';
    const runner: ProposalRunner = async (prompt, _stdin, _schema, _opts) => {
      receivedPrompt = prompt;
      return successRunner()(prompt, _stdin, _schema, _opts);
    };

    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });

    expect(summary.status).toBe('completed');
    expect(summary.processed[0]?.status).toBe('done');
    expect(summary.remaining).toBe(0);
    // The transcript body must be substituted into the prompt template.
    expect(receivedPrompt).toContain('TRANSCRIPT-BODY-MARKER');
    expect(receivedPrompt).not.toContain('[TRANSCRIPT PLACEHOLDER');

    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['proposal_status']).toBe('done');
    expect(after.data['proposal_log']).toMatch(/_logs\/proposal\//);
    const proposals = after.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);
    expect(proposals.map).toHaveLength(1);
  });

  it('processes only pending logs, ignoring done/failed entries', async () => {
    seedSessionWithStatus(harness, 'already-done', 'done');
    seedSessionWithStatus(harness, 'already-failed', 'failed');
    const pendingFile = seedSession(harness, 'fresh', '[USER]: hi');

    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });

    expect(summary.processed).toHaveLength(1);
    expect(summary.processed[0]?.sessionId).toBe('fresh');
    const after = matter(readFileSync(join(harness.sessionsDir, pendingFile), 'utf8'));
    expect(after.data['proposal_status']).toBe('done');
  });

  it('marks a log as failed on runner error without retrying within the drain', async () => {
    const file = seedSession(harness, 'doomed', '[USER]: hi-doomed');
    let calls = 0;
    const runner: ProposalRunner = async () => {
      calls += 1;
      throw new Error('schema mismatch');
    };

    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });

    expect(calls).toBe(1);
    expect(summary.processed[0]?.status).toBe('failed');
    expect(summary.remaining).toBe(0);
    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['proposal_status']).toBe('failed');
    expect(after.data['proposal_error']).toContain('schema mismatch');
  });

  it('returns status=locked and leaves the queue untouched when another process holds the lock', async () => {
    seedSession(harness, 's2', '[USER]: hi');
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    try {
      const summary = await drainProposalQueue({
        paths: harness.paths,
        promptTemplate: PROMPT_TEMPLATE,
        runner: successRunner(),
      });
      expect(summary.status).toBe('locked');
      expect(summary.remaining).toBe(1);
    } finally {
      await release();
    }
  });

  it('respects maxEntries and leaves remaining pending logs untouched', async () => {
    for (const id of ['a', 'b', 'c', 'd']) seedSession(harness, id, `[USER]: hi-${id}`);
    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
      maxEntries: 2,
    });
    expect(summary.processed).toHaveLength(2);
    expect(summary.remaining).toBe(2);
  });
});
