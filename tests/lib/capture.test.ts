import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureSession } from '../../src/lib/capture.js';
import type { SecretScanner } from '../../src/lib/secret-scan.js';
import { cleanSandbox, makeSandbox } from '../helpers.js';

function fakeScanner(behavior: 'clean' | 'blocked' | 'redact' = 'clean'): SecretScanner {
  return async (text: string) => {
    if (behavior === 'blocked')
      return { status: 'blocked', redactedText: '', findings: [], error: 'fake blocked' };
    if (behavior === 'redact')
      return {
        status: 'redacted',
        redactedText: text.replace(/sk-[a-z0-9]+/gi, '[REDACTED:test-secret]'),
        findings: [{ ruleId: 'test-secret', secret: 'sk-abc123' }],
      };
    return { status: 'clean', redactedText: text, findings: [] };
  };
}

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

  it('writes a session log, dedup-cache entry, and queue entry on a fresh capture', async () => {
    const result = await captureSession(
      {
        session_id: 'sess-1',
        transcript_path: transcriptPath,
        hook_event_name: 'Stop',
      },
      { sessionsDir, scan: fakeScanner('clean') }
    );
    expect(result.status).toBe('written');
    expect(result.secretScanStatus).toBe('clean');

    // session log file exists with the expected frontmatter
    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
    expect(files).toHaveLength(1);
    const logName = files[0];
    expect(logName).toBeDefined();
    const log = readFileSync(join(sessionsDir, logName as string), 'utf8');
    const fm = matter(log).data as {
      session_id: string;
      captured_by: string;
      stage_2_status: string;
      secret_scan_status: string;
      transcript_hash: string;
    };
    expect(fm.session_id).toBe('sess-1');
    expect(fm.captured_by).toBe('stop');
    expect(fm.stage_2_status).toBe('pending');
    expect(fm.secret_scan_status).toBe('clean');
    expect(fm.transcript_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    // queue + dedup cache populated
    const queue = JSON.parse(readFileSync(join(sessionsDir, '.queue.json'), 'utf8')) as {
      entries: Array<{ session_id: string; session_log: string }>;
    };
    expect(queue.entries).toHaveLength(1);
    expect(queue.entries[0]?.session_id).toBe('sess-1');
    expect(queue.entries[0]?.session_log).toBe(logName);

    const cache = JSON.parse(readFileSync(join(sessionsDir, '.dedup-cache.json'), 'utf8')) as {
      entries: Array<{ hash: string; expires_at: string }>;
    };
    expect(cache.entries).toHaveLength(1);
  });

  it('returns duplicate status on a repeat within the dedup window', async () => {
    const ctx = { sessionsDir, scan: fakeScanner('clean') };
    const first = await captureSession(
      { session_id: 'x', transcript_path: transcriptPath, hook_event_name: 'Stop' },
      ctx
    );
    expect(first.status).toBe('written');
    const second = await captureSession(
      { session_id: 'x', transcript_path: transcriptPath, hook_event_name: 'SessionEnd' },
      ctx
    );
    expect(second.status).toBe('duplicate');
    // No second log written.
    expect(readdirSync(sessionsDir).filter(f => f.endsWith('.md'))).toHaveLength(1);
  });

  it('redacts findings into the session log when scanner returns redacted', async () => {
    // Add a secret-shaped string to the transcript.
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'key is sk-abc123 do not share' },
        }),
      ].join('\n')
    );
    const result = await captureSession(
      { session_id: 'secret-1', transcript_path: transcriptPath, hook_event_name: 'Stop' },
      { sessionsDir, scan: fakeScanner('redact') }
    );
    expect(result.status).toBe('written');
    expect(result.secretScanStatus).toBe('redacted');

    const log = readFileSync(
      join(sessionsDir, readdirSync(sessionsDir).filter(f => f.endsWith('.md'))[0] as string),
      'utf8'
    );
    expect(log).toContain('[REDACTED:test-secret]');
    expect(log).not.toContain('sk-abc123');
  });

  it('aborts without writing when the scanner is blocked', async () => {
    const result = await captureSession(
      { session_id: 'x', transcript_path: transcriptPath, hook_event_name: 'Stop' },
      { sessionsDir, scan: fakeScanner('blocked') }
    );
    expect(result.status).toBe('secret-scan-blocked');
    expect(result.error).toContain('fake blocked');
    expect(readdirSync(sessionsDir).filter(f => f.endsWith('.md'))).toHaveLength(0);
  });

  it('returns no-transcript when transcript_path is missing', async () => {
    const result = await captureSession(
      { session_id: 'x', transcript_path: '/nonexistent/path.jsonl', hook_event_name: 'Stop' },
      { sessionsDir, scan: fakeScanner('clean') }
    );
    expect(result.status).toBe('no-transcript');
  });

  it('returns no-content when the transcript has no user or assistant text', async () => {
    writeFileSync(transcriptPath, JSON.stringify({ type: 'system', content: 'nothing' }));
    const result = await captureSession(
      { session_id: 'x', transcript_path: transcriptPath, hook_event_name: 'Stop' },
      { sessionsDir, scan: fakeScanner('clean') }
    );
    expect(result.status).toBe('no-content');
  });

  it('uses captured_by derived from hook_event_name', async () => {
    const result = await captureSession(
      { session_id: 'pc', transcript_path: transcriptPath, hook_event_name: 'PreCompact' },
      { sessionsDir, scan: fakeScanner('clean') }
    );
    expect(result.status).toBe('written');
    const log = readFileSync(
      join(sessionsDir, readdirSync(sessionsDir).filter(f => f.endsWith('.md'))[0] as string),
      'utf8'
    );
    const fm = matter(log).data as { captured_by: string };
    expect(fm.captured_by).toBe('pre_compact');
  });
});
