import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureSession } from '../../src/lib/capture.js';
import { parseTranscriptJsonl } from '../../src/harnesses/claude/transcript.js';
import { cleanSandbox, makeSandbox } from '../helpers.js';

function makeTranscript(dir: string): string {
  const path = join(dir, 'transcript.jsonl');
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use bravo_pii.cache' } }),
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'understood' }] },
    }),
  ];
  writeFileSync(path, lines.join('\n'));
  return path;
}

const SESS_1 = '11111111-1111-4111-8111-111111111111';
const SESS_X = '22222222-2222-4222-8222-222222222222';
const SESS_MULTI = '44444444-4444-4444-8444-444444444444';
const SESS_PC = '55555555-5555-4555-8555-555555555555';
const SESS_CURSORY_UNDER = '66666666-6666-4666-8666-666666666666';
const SESS_CURSORY_BOUNDARY = '77777777-7777-4777-8777-777777777777';
const SESS_OVER_USER = '88888888-8888-4888-8888-888888888888';
const SESS_OVER_AGENT = '99999999-9999-4999-8999-999999999999';
const SESS_TWO_TURNS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function writeTwoTurnTranscript(path: string, userText: string, agentText: string): void {
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: userText } }),
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: agentText }] },
    }),
  ];
  writeFileSync(path, lines.join('\n'));
}

describe('captureSession', () => {
  let sandbox: string;
  let sessionsDir: string;
  let transcriptPath: string;

  beforeEach(() => {
    sandbox = makeSandbox();
    sessionsDir = join(sandbox, '_sessions');
    mkdirSync(sessionsDir, { recursive: true });
    transcriptPath = makeTranscript(sandbox);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('writes a session log with pending frontmatter on a fresh capture', async () => {
    writeTwoTurnTranscript(transcriptPath, 'u'.repeat(50), 'a'.repeat(501));
    const result = await captureSession(
      {
        session_id: SESS_1,
        transcript_path: transcriptPath,
        hook_event_name: 'Stop',
      },
      { sessionsDir, parseTranscript: parseTranscriptJsonl }
    );
    expect(result.status).toBe('written');

    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
    expect(files).toHaveLength(1);
    const logName = files[0];
    expect(logName).toBeDefined();
    const log = readFileSync(join(sessionsDir, logName as string), 'utf8');
    const fm = matter(log).data as {
      session_id: string;
      captured_by: string;
      proposal_status: string;
      transcript_hash: string;
    };
    expect(fm.session_id).toBe(SESS_1);
    expect(fm.captured_by).toBe('stop');
    expect(fm.proposal_status).toBe('pending');
    expect(fm.transcript_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('overwrites the same session log when a repeat fires for the same session_id', async () => {
    const ctx = { sessionsDir, parseTranscript: parseTranscriptJsonl };
    const first = await captureSession(
      { session_id: SESS_X, transcript_path: transcriptPath, hook_event_name: 'Stop' },
      ctx
    );
    expect(first.status).toBe('written');
    const second = await captureSession(
      { session_id: SESS_X, transcript_path: transcriptPath, hook_event_name: 'SessionEnd' },
      ctx
    );
    expect(second.status).toBe('written');
    expect(readdirSync(sessionsDir).filter(f => f.endsWith('.md'))).toHaveLength(1);
  });

  it('returns no-transcript when transcript_path is missing', async () => {
    const result = await captureSession(
      { session_id: SESS_X, transcript_path: '/nonexistent/path.jsonl', hook_event_name: 'Stop' },
      { sessionsDir, parseTranscript: parseTranscriptJsonl }
    );
    expect(result.status).toBe('no-transcript');
  });

  it('returns no-content when the transcript has no user or assistant text', async () => {
    writeFileSync(transcriptPath, JSON.stringify({ type: 'system', content: 'nothing' }));
    const result = await captureSession(
      { session_id: SESS_X, transcript_path: transcriptPath, hook_event_name: 'Stop' },
      { sessionsDir, parseTranscript: parseTranscriptJsonl }
    );
    expect(result.status).toBe('no-content');
  });

  it('reuses the existing session log file when the same session_id captures again with new turns', async () => {
    const ctx = { sessionsDir, parseTranscript: parseTranscriptJsonl };
    const first = await captureSession(
      { session_id: SESS_MULTI, transcript_path: transcriptPath, hook_event_name: 'Stop' },
      ctx
    );
    expect(first.status).toBe('written');
    const firstFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
    expect(firstFiles).toHaveLength(1);
    const firstName = firstFiles[0] as string;

    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'use bravo_pii.cache' } }),
        JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'understood' }] },
        }),
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'now what about X?' } }),
        JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'here is X' }] },
        }),
      ].join('\n')
    );

    const second = await captureSession(
      { session_id: SESS_MULTI, transcript_path: transcriptPath, hook_event_name: 'Stop' },
      ctx
    );
    expect(second.status).toBe('written');

    const secondFiles = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
    expect(secondFiles).toEqual([firstName]);

    const log = readFileSync(join(sessionsDir, firstName), 'utf8');
    expect(log).toContain('now what about X?');
    expect(log).toContain('here is X');
  });

  it('uses captured_by derived from hook_event_name', async () => {
    const result = await captureSession(
      { session_id: SESS_PC, transcript_path: transcriptPath, hook_event_name: 'PreCompact' },
      { sessionsDir, parseTranscript: parseTranscriptJsonl }
    );
    expect(result.status).toBe('written');
    const log = readFileSync(
      join(sessionsDir, readdirSync(sessionsDir).filter(f => f.endsWith('.md'))[0] as string),
      'utf8'
    );
    const fm = matter(log).data as { captured_by: string };
    expect(fm.captured_by).toBe('pre_compact');
  });

  describe('cursory pre-filter', () => {
    const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z');
    const fixedNow = (): Date => FIXED_NOW;

    function readFrontmatter(): {
      proposal_status: string;
      proposal_error: string | null;
      proposal_completed_at: string | null;
    } {
      const files = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
      expect(files).toHaveLength(1);
      const log = readFileSync(join(sessionsDir, files[0] as string), 'utf8');
      return matter(log).data as {
        proposal_status: string;
        proposal_error: string | null;
        proposal_completed_at: string | null;
      };
    }

    it('marks all-under sessions as skipped with cursory_session error', async () => {
      writeTwoTurnTranscript(transcriptPath, 'hello', 'a'.repeat(50));
      const result = await captureSession(
        {
          session_id: SESS_CURSORY_UNDER,
          transcript_path: transcriptPath,
          hook_event_name: 'Stop',
        },
        {
          sessionsDir,
          now: fixedNow,
          parseTranscript: parseTranscriptJsonl,
        }
      );
      expect(result.status).toBe('written');
      const fm = readFrontmatter();
      expect(fm.proposal_status).toBe('skipped');
      expect(fm.proposal_error).toBe('cursory_session');
      expect(fm.proposal_completed_at).toBe(FIXED_NOW.toISOString());
    });

    it('treats threshold boundaries as inclusive (skipped)', async () => {
      writeTwoTurnTranscript(transcriptPath, 'u'.repeat(200), 'a'.repeat(500));
      const result = await captureSession(
        {
          session_id: SESS_CURSORY_BOUNDARY,
          transcript_path: transcriptPath,
          hook_event_name: 'Stop',
        },
        {
          sessionsDir,
          now: fixedNow,
          parseTranscript: parseTranscriptJsonl,
        }
      );
      expect(result.status).toBe('written');
      const fm = readFrontmatter();
      expect(fm.proposal_status).toBe('skipped');
      expect(fm.proposal_error).toBe('cursory_session');
      expect(fm.proposal_completed_at).toBe(FIXED_NOW.toISOString());
    });

    it('keeps pending when user chars exceed the threshold by one', async () => {
      writeTwoTurnTranscript(transcriptPath, 'u'.repeat(201), 'a'.repeat(100));
      const result = await captureSession(
        {
          session_id: SESS_OVER_USER,
          transcript_path: transcriptPath,
          hook_event_name: 'Stop',
        },
        {
          sessionsDir,
          now: fixedNow,
          parseTranscript: parseTranscriptJsonl,
        }
      );
      expect(result.status).toBe('written');
      const fm = readFrontmatter();
      expect(fm.proposal_status).toBe('pending');
      expect(fm.proposal_error).toBeNull();
      expect(fm.proposal_completed_at).toBeNull();
    });

    it('keeps pending when agent chars exceed the threshold by one', async () => {
      writeTwoTurnTranscript(transcriptPath, 'u'.repeat(50), 'a'.repeat(501));
      const result = await captureSession(
        {
          session_id: SESS_OVER_AGENT,
          transcript_path: transcriptPath,
          hook_event_name: 'Stop',
        },
        {
          sessionsDir,
          now: fixedNow,
          parseTranscript: parseTranscriptJsonl,
        }
      );
      expect(result.status).toBe('written');
      const fm = readFrontmatter();
      expect(fm.proposal_status).toBe('pending');
      expect(fm.proposal_error).toBeNull();
      expect(fm.proposal_completed_at).toBeNull();
    });

    it('keeps pending when there are two user turns at low char counts', async () => {
      const lines = [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' } }),
        JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'a'.repeat(50) }] },
        }),
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'again' } }),
      ];
      writeFileSync(transcriptPath, lines.join('\n'));
      const result = await captureSession(
        {
          session_id: SESS_TWO_TURNS,
          transcript_path: transcriptPath,
          hook_event_name: 'Stop',
        },
        {
          sessionsDir,
          now: fixedNow,
          parseTranscript: parseTranscriptJsonl,
        }
      );
      expect(result.status).toBe('written');
      const fm = readFrontmatter();
      expect(fm.proposal_status).toBe('pending');
      expect(fm.proposal_error).toBeNull();
      expect(fm.proposal_completed_at).toBeNull();
    });
  });
});
