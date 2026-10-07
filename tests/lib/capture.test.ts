import { createHash } from 'node:crypto';
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
import { markSessionsProcessed } from '../../src/lib/curate.js';
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
  const turnsV2: RoleTaggedTranscript['interleaved'] = [
    ...turnsV1,
    { role: 'user', text: 'SECOND-TURN-QUESTION' },
    { role: 'agent', text: 'SECOND-TURN-ANSWER' },
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

  it('after a versioned stamp, appended turns become pending and only the delta is extractable', async () => {
    const first = await capture(turnsV1);
    const path = first.sessionLogPath as string;
    markDone(path);
    const v1 = readLog(path);
    const v1Hash = v1.data['transcript_hash'] as string;
    const v1Chars = v1.data['transcript_chars'] as number;
    expect(typeof v1Chars).toBe('number');
    markSessionsProcessed(
      [{ path, transcript_hash: v1Hash, transcript_chars: v1Chars }],
      'run-1',
      new Date('2026-06-20T11:00:00.000Z')
    );
    const stamped = readLog(path);
    expect(stamped.data['curated_transcript_hash']).toBe(v1Hash);
    expect(stamped.data['curated_transcript_chars']).toBe(v1Chars);

    const grown = await capture(turnsV2);
    expect(grown.status).toBe('written');
    const log = readLog(path);
    // New version identity, stamp of the consumed version retained.
    expect(log.data['transcript_hash']).not.toBe(v1Hash);
    expect(log.data['transcript_chars']).toBeGreaterThan(v1Chars);
    expect(log.data['curator_processed_at']).toBe('2026-06-20T11:00:00.000Z');
    expect(log.data['curator_run_id']).toBe('run-1');
    expect(log.data['curated_transcript_hash']).toBe(v1Hash);
    expect(log.data['curated_transcript_chars']).toBe(v1Chars);
    // Extraction state reset for the new content only.
    expect(log.data['proposal_status']).toBe('pending');
    expect(log.data['proposals']).toEqual({ practice: [], map: [] });
    expect(log.data['proposal_completed_at']).toBeNull();
    // The curated prefix is kept for context but out of the extractable section.
    const prefixSection = log.content.slice(
      log.content.indexOf('## Curated prefix'),
      log.content.indexOf('## Transcript')
    );
    const transcriptSection = log.content.slice(
      log.content.indexOf('## Transcript'),
      log.content.indexOf('## Proposal')
    );
    expect(prefixSection).toContain('first question');
    expect(prefixSection).not.toContain('SECOND-TURN-QUESTION');
    expect(transcriptSection).toContain('SECOND-TURN-QUESTION');
    expect(transcriptSection).toContain('SECOND-TURN-ANSWER');
    expect(transcriptSection).not.toContain('first question');
    // The full slice is still what the hash covers.
    const fullHash = `sha256:${createHash('sha256')
      .update(
        `[USER]: ${turnsV2[0]!.text}\n\n[AGENT]: ${turnsV2[1]!.text}\n\n[USER]: SECOND-TURN-QUESTION\n\n[AGENT]: SECOND-TURN-ANSWER`
      )
      .digest('hex')}`;
    expect(log.data['transcript_hash']).toBe(fullHash);
  });

  it('a rewritten transcript after a stamp re-opens the whole body as pending with the stamp retained', async () => {
    const first = await capture(turnsV1);
    const path = first.sessionLogPath as string;
    markDone(path);
    const v1 = readLog(path).data;
    const v1Hash = v1['transcript_hash'] as string;
    markSessionsProcessed(
      [{ path, transcript_hash: v1Hash, transcript_chars: v1['transcript_chars'] as number }],
      'run-1',
      new Date('2026-06-20T11:00:00.000Z')
    );

    // Post-compaction shape: the earlier turns are no longer a prefix.
    const rewritten = await capture([
      { role: 'user', text: `[compacted summary] ${FILLER}` },
      { role: 'agent', text: `REWRITTEN-ANSWER ${FILLER}${FILLER}` },
    ]);
    expect(rewritten.status).toBe('written');
    const log = readLog(path);
    expect(log.data['proposal_status']).toBe('pending');
    expect(log.data['curated_transcript_hash']).toBe(v1Hash);
    expect(log.content).not.toContain('## Curated prefix');
    expect(log.content).toContain('REWRITTEN-ANSWER');
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
