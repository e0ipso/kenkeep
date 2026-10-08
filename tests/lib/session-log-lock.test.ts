import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import lockfile from 'proper-lockfile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureSession, type TranscriptParser } from '../../src/lib/capture.js';
import { writeSessionLogFrontmatter } from '../../src/lib/proposal-drain.js';
import type { RoleTaggedTranscript } from '../../src/harnesses/types.js';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const FILLER = 'context that should stay in the capture. '.repeat(12);
const parser: TranscriptParser = text => JSON.parse(text) as RoleTaggedTranscript;
const turnsV1: RoleTaggedTranscript['interleaved'] = [
  { role: 'user', text: `${FILLER} first question` },
  { role: 'agent', text: `first answer. ${FILLER}${FILLER}` },
];
const turnsV2: RoleTaggedTranscript['interleaved'] = [
  ...turnsV1,
  { role: 'user', text: `NEWER-DURABLE-FACT ${FILLER}` },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('session log lock between capture and proposal write-back', () => {
  let dir: string;
  let sessionsDir: string;
  let transcriptFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kk-session-log-lock-'));
    sessionsDir = join(dir, '_sessions');
    transcriptFile = join(dir, 't.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function capture(turns: RoleTaggedTranscript['interleaved']) {
    writeFileSync(transcriptFile, JSON.stringify({ interleaved: turns }));
    return captureSession(
      { session_id: SESSION_ID, transcript_path: transcriptFile },
      { sessionsDir, parseTranscript: parser }
    );
  }

  const hashOf = (path: string) =>
    matter(readFileSync(path, 'utf8')).data['transcript_hash'] as string;

  it('a capture waits for a write-back holding the log, then lands its newer version', async () => {
    const path = (await capture(turnsV1)).sessionLogPath as string;
    const h1 = hashOf(path);

    // A write-back that already checked h1 holds the log until its rename.
    const release = await lockfile.lock(path, { realpath: false });
    const pending = capture(turnsV2);
    await sleep(150);
    expect(hashOf(path)).toBe(h1);

    await release();
    const result = await pending;
    expect(result.status).toBe('written');
    expect(hashOf(path)).not.toBe(h1);
    expect(readFileSync(path, 'utf8')).toContain('NEWER-DURABLE-FACT');
  });

  it('a write-back re-reads the log under the lock and refuses a version that moved', async () => {
    const path = (await capture(turnsV1)).sessionLogPath as string;
    const h1 = hashOf(path);
    const before = readFileSync(path, 'utf8');

    // A capture holds the log while the write-back for h1 arrives.
    const release = await lockfile.lock(path, { realpath: false });
    const pending = writeSessionLogFrontmatter(path, h1, {
      proposal_status: 'done',
      proposal_completed_at: '2026-06-20T10:05:00.000Z',
      proposal_error: null,
      proposal_log: null,
      proposals: { practice: [], map: [] },
    });
    await sleep(150);
    expect(readFileSync(path, 'utf8')).toBe(before);

    const parsed = matter(before);
    const newer = { ...(parsed.data as Record<string, unknown>), transcript_hash: 'sha256:newer' };
    writeFileSync(path, matter.stringify(`${parsed.content}\nNEWER-DURABLE-FACT\n`, newer));
    await release();

    expect(await pending).toEqual({ ok: false, currentHash: 'sha256:newer' });
    expect(hashOf(path)).toBe('sha256:newer');
    expect(readFileSync(path, 'utf8')).toContain('NEWER-DURABLE-FACT');
  });
});
