import matter from 'gray-matter';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repoPaths, type RepoPaths } from '../../src/lib/paths.js';
import { renderSessionLog } from '../../src/lib/session-log.js';
import {
  buildProposalPrompt,
  drainProposalQueue,
  TRANSCRIPT_PLACEHOLDER,
  type ProposalRunner,
} from '../../src/lib/proposal-drain.js';
import { STATE_LOCK_OPTIONS } from '../../src/lib/state.js';

interface Harness {
  root: string;
  paths: RepoPaths;
  sessionsDir: string;
  logsDir: string;
  stateFile: string;
}

function makeHarness(): Harness {
  const root = mkdtempSync(join(tmpdir(), 'kb-drain-'));
  const paths = repoPaths(root);
  const stateFile = join(paths.stateDir, 'state.json');
  mkdirSync(paths.sessionsDir, { recursive: true });
  mkdirSync(paths.logsDir, { recursive: true });
  mkdirSync(paths.stateDir, { recursive: true });
  return {
    root,
    paths,
    sessionsDir: paths.sessionsDir,
    logsDir: paths.logsDir,
    stateFile,
  };
}

function seedSession(harness: Harness, sessionId: string, transcript: string): string {
  const filename = `session-${sessionId}.md`;
  const body = renderSessionLog({
    sessionId,
    capturedBy: 'stop',
    capturedAt: '2026-05-11T10:00:00Z',
    transcriptHash: `sha256:${sessionId}`,
    secretScanStatus: 'clean',
    body: transcript,
  });
  writeFileSync(join(harness.sessionsDir, filename), body);
  return filename;
}

function seedSessionWithStatus(
  harness: Harness,
  sessionId: string,
  status: 'done' | 'failed' | null
): string {
  const filename = seedSession(harness, sessionId, '[USER]: hi');
  if (status === null) return filename;
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

function failingRunner(message: string): ProposalRunner {
  return async () => {
    throw new Error(message);
  };
}

describe('drainProposalQueue', () => {
  let harness: Harness;
  beforeEach(() => {
    harness = makeHarness();
  });
  afterEach(() => rmSync(harness.root, { recursive: true, force: true }));

  it('processes a pending session log on success and updates frontmatter', async () => {
    const file = seedSession(harness, 's1', '[USER]: use bravo_pii.cache for PII\n[AGENT]: ok');

    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });

    expect(summary.status).toBe('completed');
    expect(summary.processed[0]?.status).toBe('done');
    expect(summary.remaining).toBe(0);

    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['proposal_status']).toBe('done');
    expect(after.data['proposal_log']).toMatch(/_logs\/proposal\//);
    const proposals = after.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);
    expect(proposals.map).toHaveLength(1);
  });

  it('ignores session logs whose proposal_status is not pending', async () => {
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

  it('skips dotfiles in the sessions directory', async () => {
    writeFileSync(join(harness.sessionsDir, '.hidden.md'), 'irrelevant');
    seedSession(harness, 'visible', '[USER]: hi');

    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });

    expect(summary.processed).toHaveLength(1);
    expect(summary.processed[0]?.sessionId).toBe('visible');
  });

  it('substitutes the transcript into the prompt template before invoking the runner', async () => {
    seedSession(harness, 's-sub', 'TRANSCRIPT-BODY-MARKER');
    let receivedPrompt = '';
    const runner: ProposalRunner = async (prompt, _stdin, _schema, _opts) => {
      receivedPrompt = prompt;
      return { practice: [], map: [] };
    };

    await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });

    expect(receivedPrompt).toContain('TRANSCRIPT-BODY-MARKER');
    expect(receivedPrompt).not.toContain('[TRANSCRIPT PLACEHOLDER');
  });

  it('returns status=locked when another process holds the lock', async () => {
    seedSession(harness, 's2', '[USER]: hi');
    mkdirSync(harness.paths.stateDir, { recursive: true });
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
    for (const id of ['a', 'b', 'c', 'd']) {
      seedSession(harness, id, `[USER]: hi-${id}`);
    }
    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
      maxEntries: 2,
    });
    expect(summary.processed).toHaveLength(2);
    expect(summary.remaining).toBe(2);
  });

  it('marks a session log as failed on runner error without retrying within the drain', async () => {
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
    const after = matter(readFileSync(join(harness.sessionsDir, file), 'utf8'));
    expect(after.data['proposal_status']).toBe('failed');
    expect(after.data['proposal_error']).toContain('schema mismatch');
    expect(summary.remaining).toBe(0);
  });

  it('releases the lock after completion', async () => {
    seedSession(harness, 's3', '[USER]: hi');
    await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    await release();
  });

  it('releases the lock even if a runner throws an unexpected error', async () => {
    seedSession(harness, 's4', '[USER]: hi');
    await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: failingRunner('boom'),
    });
    const release = await lockfile.lock(harness.stateFile, STATE_LOCK_OPTIONS);
    await release();
  });

  it('does nothing and reports remaining=0 when no pending logs exist', async () => {
    const summary = await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner: successRunner(),
    });
    expect(summary.processed).toHaveLength(0);
    expect(summary.remaining).toBe(0);
    expect(existsSync(harness.logsDir)).toBe(true);
  });

  it('forwards harnessOpts to the runner when set, omits them otherwise', async () => {
    seedSession(harness, 's-model', '[USER]: hi');
    let captured: Record<string, unknown> | undefined;
    const runner: ProposalRunner = async (_p, _s, _schema, opts) => {
      captured = opts.harnessOpts;
      return { practice: [], map: [] };
    };
    await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
      harnessOpts: { model: 'haiku', effort: 'low' },
    });
    expect(captured).toEqual({ model: 'haiku', effort: 'low' });

    seedSession(harness, 's-no-model', '[USER]: hi');
    captured = undefined;
    await drainProposalQueue({
      paths: harness.paths,
      promptTemplate: PROMPT_TEMPLATE,
      runner,
    });
    expect(captured).toBeUndefined();
  });
});

describe('buildProposalPrompt', () => {
  it('substitutes the transcript placeholder when present', () => {
    const out = buildProposalPrompt(`prefix ${TRANSCRIPT_PLACEHOLDER} suffix`, 'TRANS');
    expect(out).toBe('prefix TRANS suffix');
  });

  it('throws when the placeholder is missing, naming the placeholder and the proposal-extract prompt', () => {
    expect(() => buildProposalPrompt('no placeholder here', 'TRANS')).toThrowError(
      new RegExp(
        `proposal-extract prompt is missing the ${TRANSCRIPT_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      )
    );
  });
});
