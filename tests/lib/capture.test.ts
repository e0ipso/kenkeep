import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
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

  it('removes a nested span through its own closing tag, never leaking outer content', () => {
    const text =
      'keep <kk-private>outer <kk-private>inner secret</kk-private> OUTER-SECRET </kk-private> tail';
    expect(stripPrivateSpans(text)).toBe(`keep ${PRIVATE_SPAN_PLACEHOLDER} tail`);
    expect(
      stripPrivateSpans(
        '<kk-private>a<kk-private>b</kk-private>c</kk-private><kk-private>d</kk-private>'
      )
    ).toBe(`${PRIVATE_SPAN_PLACEHOLDER}${PRIVATE_SPAN_PLACEHOLDER}`);
  });

  it('strips to the end when a nested span leaves the outer one unclosed', () => {
    expect(
      stripPrivateSpans('keep <kk-private>outer <kk-private>inner</kk-private> OUTER-SECRET')
    ).toBe(`keep ${PRIVATE_SPAN_PLACEHOLDER}`);
  });

  it('leaves a closing tag with no open span as text', () => {
    expect(stripPrivateSpans('a </kk-private> b <kk-private>x</kk-private>')).toBe(
      `a </kk-private> b ${PRIVATE_SPAN_PLACEHOLDER}`
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

describe('captureSession transcript-version binding', () => {
  let dir: string;
  let sessionsDir: string;
  let transcriptFile: string;
  const fixedNow = () => new Date('2026-06-20T12:00:00.000Z');
  const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;
  const turnsV1: RoleTaggedTranscript['interleaved'] = [
    { role: 'user', text: `${FILLER} first question` },
    { role: 'agent', text: `first answer. ${FILLER}${FILLER}` },
  ];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-capture-version-'));
    sessionsDir = join(dir, '_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    transcriptFile = join(dir, 't.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function capture(turns: RoleTaggedTranscript['interleaved']) {
    writeFileSync(transcriptFile, JSON.stringify({ interleaved: turns }));
    return captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir, parseTranscript: parser, now: fixedNow }
    );
  }

  function readLog(path: string) {
    const raw = readFileSync(path, 'utf8');
    return { raw, ...matter(raw) };
  }

  /** Simulates the drain finishing extraction for the current version. */
  function markDone(path: string): void {
    const parsed = matter(readFileSync(path, 'utf8'));
    const data = { ...(parsed.data as Record<string, unknown>) };
    data['proposal_status'] = 'done';
    data['proposal_completed_at'] = '2026-06-20T10:05:00.000Z';
    data['proposals'] = { practice: [{ title: 'Kept' }], map: [] };
    writeFileSync(path, matter.stringify(parsed.content, data));
  }

  it('recapturing identical content leaves a done log and its proposals untouched', async () => {
    const first = await capture(turnsV1);
    const path = first.sessionLogPath as string;
    markDone(path);
    const before = readFileSync(path, 'utf8');

    // Duplicate Stop/SessionEnd for the same transcript: same hash, no new version.
    const again = await capture(turnsV1);
    expect(again.status).toBe('unchanged');
    expect(again.sessionLogPath).toBe(path);
    expect(readFileSync(path, 'utf8')).toBe(before);
    const log = readLog(path);
    expect(log.data['proposal_status']).toBe('done');
    expect((log.data['proposals'] as { practice: unknown[] }).practice).toHaveLength(1);
  });

  it('a changed capture over an unversioned (pre-binding) stamp starts a fresh lifecycle', async () => {
    const legacy = renderSessionLog({
      sessionId: SESSION_ID,
      capturedBy: 'stop',
      capturedAt: '2026-06-20T10:00:00.000Z',
      transcriptHash: 'sha256:old',
      body: 'old transcript',
      proposalStatus: 'done',
      proposalCompletedAt: '2026-06-20T10:05:00.000Z',
      proposals: { practice: [{ title: 'Old' }], map: [] },
      curatorProcessedAt: '2026-06-20T11:00:00.000Z',
      curatorRunId: 'run-legacy',
    });
    const path = join(sessionsDir, `20260620-1000-${SESSION_ID}.md`);
    writeFileSync(path, legacy);

    const result = await capture(turnsV1);
    expect(result.status).toBe('written');
    const log = readLog(path);
    expect(log.data['proposal_status']).toBe('pending');
    expect(log.data['curator_processed_at']).toBeUndefined();
    expect(log.data['curator_run_id']).toBeUndefined();
    expect(log.data['proposals']).toEqual({ practice: [], map: [] });
  });
});
