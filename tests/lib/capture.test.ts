import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  captureSession,
  PRIVATE_SPAN_PLACEHOLDER,
  stripPrivateSpans,
  type TranscriptParser,
} from '../../src/lib/capture.js';
import { renderSessionLog } from '../../src/lib/session-log.js';
import type { RoleTaggedTranscript } from '../../src/harnesses/types.js';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const FILLER = 'context that should stay in the capture. '.repeat(12);

describe('stripPrivateSpans', () => {
  it('removes closed spans, multiline spans, and multiple spans', () => {
    expect(stripPrivateSpans('a <kk-private>secret</kk-private> b')).toBe(
      `a ${PRIVATE_SPAN_PLACEHOLDER} b`
    );
    expect(stripPrivateSpans('a <kk-private>line1\nline2</kk-private> b')).toBe(
      `a ${PRIVATE_SPAN_PLACEHOLDER} b`
    );
    expect(stripPrivateSpans('<kk-private>x</kk-private> mid <kk-private>y</kk-private>')).toBe(
      `${PRIVATE_SPAN_PLACEHOLDER} mid ${PRIVATE_SPAN_PLACEHOLDER}`
    );
  });

  it('strips an unclosed tag to the end of the text (privacy-first)', () => {
    expect(stripPrivateSpans('keep this <kk-private>token=abc and everything after')).toBe(
      `keep this ${PRIVATE_SPAN_PLACEHOLDER}`
    );
  });

  it('leaves unmarked text untouched', () => {
    expect(stripPrivateSpans(FILLER)).toBe(FILLER);
  });
});

describe('captureSession private-span integration', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-capture-priv-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('marked spans never reach the session log', async () => {
    const transcript: RoleTaggedTranscript = {
      interleaved: [
        { role: 'user', text: `${FILLER} <kk-private>API_KEY=hunter2</kk-private>` },
        { role: 'agent', text: `understood. ${FILLER}${FILLER}` },
      ],
    };
    const transcriptFile = join(dir, 't.json');
    writeFileSync(transcriptFile, JSON.stringify(transcript));
    const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;

    const result = await captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir: join(dir, '_sessions'), parseTranscript: parser }
    );
    expect(result.status).toBe('written');
    const log = readFileSync(result.sessionLogPath as string, 'utf8');
    expect(log).not.toContain('hunter2');
    expect(log).toContain(PRIVATE_SPAN_PLACEHOLDER);
    expect(log).toContain('context that should stay');
  });
});

describe('captureSession curated-state preservation', () => {
  let dir: string;
  const fixedNow = () => new Date('2026-06-20T12:00:00.000Z');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-capture-curated-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('preserves curator stamps and terminal proposal state on same-session rewrite', async () => {
    const sessionsDir = join(dir, '_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const existingBody = renderSessionLog({
      sessionId: SESSION_ID,
      capturedBy: 'manual',
      capturedAt: '2026-06-20T10:00:00.000Z',
      transcriptHash: 'sha256:old',
      body: 'old transcript',
      proposalStatus: 'done',
      proposalCompletedAt: '2026-06-20T10:05:00.000Z',
      proposals: {
        practice: [
          {
            kind: 'practice',
            tags: ['a'],
            title: 'Kept',
            summary: 'kept summary',
            body: 'kept body',
            confidence: 'high',
          },
        ],
        map: [],
      },
      curatorProcessedAt: '2026-06-20T11:00:00.000Z',
      curatorRunId: 'run-abc',
    });
    writeFileSync(join(sessionsDir, `20260620-1000-${SESSION_ID}.md`), existingBody);

    const transcript: RoleTaggedTranscript = {
      interleaved: [
        { role: 'user', text: `${FILLER} updated question` },
        { role: 'agent', text: `updated answer. ${FILLER}${FILLER}` },
      ],
    };
    const transcriptFile = join(dir, 't.json');
    writeFileSync(transcriptFile, JSON.stringify(transcript));
    const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;

    const result = await captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir, parseTranscript: parser, now: fixedNow }
    );
    expect(result.status).toBe('written');

    const log = readFileSync(result.sessionLogPath as string, 'utf8');
    expect(log).toContain('updated question');
    expect(log).toMatch(/curator_processed_at:\s*'?2026-06-20T11:00:00.000Z'?/);
    expect(log).toMatch(/curator_run_id:\s*run-abc/);
    expect(log).toMatch(/proposal_status:\s*done/);
    expect(log).toContain('Kept');
  });

  it('does not preserve proposal state when curator_processed_at is absent', async () => {
    const sessionsDir = join(dir, '_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const existingBody = renderSessionLog({
      sessionId: SESSION_ID,
      capturedBy: 'stop',
      capturedAt: '2026-06-20T10:00:00.000Z',
      transcriptHash: 'sha256:old',
      body: 'old transcript',
      proposalStatus: 'pending',
    });
    writeFileSync(join(sessionsDir, `20260620-1000-${SESSION_ID}.md`), existingBody);

    const transcript: RoleTaggedTranscript = {
      interleaved: [{ role: 'user', text: 'hi' }],
    };
    const transcriptFile = join(dir, 't-short.json');
    writeFileSync(transcriptFile, JSON.stringify(transcript));
    const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;

    const result = await captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir, parseTranscript: parser, now: fixedNow }
    );
    expect(result.status).toBe('written');

    const log = readFileSync(result.sessionLogPath as string, 'utf8');
    expect(log).toMatch(/proposal_status:\s*skipped/);
    expect(log).not.toMatch(/curator_processed_at:/);
  });
});
