import matter from 'gray-matter';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSessionLog } from '../../src/lib/session-log.js';
import { cliPath } from '../helpers.js';

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCliWithStdin(cwd: string, args: string[], stdin: string): Promise<RunResult> {
  return new Promise(resolveFn => {
    const proc = spawn('node', [cliPath, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on('close', code => {
      resolveFn({ stdout, stderr, exitCode: code ?? 1 });
    });
    proc.stdin?.write(stdin);
    proc.stdin?.end();
  });
}

describe('session-log update-proposals CLI', () => {
  let sandbox: string;
  let sessionPath: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kk-session-log-update-'));
    sessionPath = join(sandbox, '20260511-1000-test-session.md');
    writeFileSync(
      sessionPath,
      renderSessionLog({
        sessionId: 'test-session',
        capturedBy: 'stop',
        capturedAt: '2026-05-11T10:00:00Z',
        transcriptHash: 'sha256:abc',
        body: '[USER]: hello',
      })
    );
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('writes frontmatter on valid --status done input', async () => {
    const payload = JSON.stringify({
      practice: [
        {
          type: 'practice',
          tags: ['test'],
          title: 'Test',
          description: 'Test summary',
          body: 'Test body',
          kk_confidence: 'high',
        },
      ],
      map: [],
    });

    const result = await runCliWithStdin(
      sandbox,
      [
        'session-log',
        'update-proposals',
        sessionPath,
        '--status',
        'done',
        '--expected-hash',
        'sha256:abc',
      ],
      payload
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('test-session');

    const after = matter(readFileSync(sessionPath, 'utf8'));
    expect(after.data['proposal_status']).toBe('done');
    expect(after.data['proposal_completed_at']).toBeTruthy();
    expect(after.data['proposal_error']).toBeNull();
    const proposals = after.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);
    expect(after.content).toContain('_Extraction complete; see proposals in frontmatter._');
    expect(after.content).not.toContain('(populated by proposal worker)');
  });

  it('exits non-zero on invalid JSON with --status done', async () => {
    const result = await runCliWithStdin(
      sandbox,
      [
        'session-log',
        'update-proposals',
        sessionPath,
        '--status',
        'done',
        '--expected-hash',
        'sha256:abc',
      ],
      'not valid json'
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/invalid JSON/i);
  });

  it('sets error fields with --status failed', async () => {
    const result = await runCliWithStdin(
      sandbox,
      [
        'session-log',
        'update-proposals',
        sessionPath,
        '--status',
        'failed',
        '--error',
        'extraction timed out',
        '--expected-hash',
        'sha256:abc',
      ],
      ''
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('test-session');

    const after = matter(readFileSync(sessionPath, 'utf8'));
    expect(after.data['proposal_status']).toBe('failed');
    expect(after.data['proposal_error']).toBe('extraction timed out');
  });
});

describe('session-log update-proposals transcript-version binding', () => {
  let sandbox: string;
  let sessionPath: string;
  const v1 = renderSessionLog({
    sessionId: 'test-session',
    capturedBy: 'stop',
    capturedAt: '2026-05-11T10:00:00Z',
    transcriptHash: 'sha256:v1',
    body: '[USER]: version one',
  });
  const v2 = renderSessionLog({
    sessionId: 'test-session',
    capturedBy: 'stop',
    capturedAt: '2026-05-11T10:01:00Z',
    transcriptHash: 'sha256:v2',
    body: '[USER]: version one\n\n[USER]: NEWER-TURN',
  });
  const payload = JSON.stringify({ practice: [], map: [] });

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kk-session-log-version-'));
    sessionPath = join(sandbox, '20260511-1000-test-session.md');
    writeFileSync(sessionPath, v1);
  });
  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('refuses to write without --expected-hash', async () => {
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'update-proposals', sessionPath, '--status', 'done'],
      payload
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/expected-hash/);
    expect(readFileSync(sessionPath, 'utf8')).toBe(v1);
  });

  it('refuses stale proposals when a newer capture landed during inline extraction', async () => {
    // The in-host extractor read v1 and is still "thinking" (stdin open) when
    // the capture hook writes v2; its result must not attach to the newer body.
    const proc = spawn(
      'node',
      [
        cliPath,
        'session-log',
        'update-proposals',
        sessionPath,
        '--status',
        'done',
        '--expected-hash',
        'sha256:v1',
      ],
      { cwd: sandbox, env: { ...process.env, NO_COLOR: '1' } }
    );
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    const exit = new Promise<number>(res => proc.on('close', code => res(code ?? 1)));
    await new Promise(res => setTimeout(res, 300));
    writeFileSync(sessionPath, v2);
    proc.stdin?.write(payload);
    proc.stdin?.end();

    expect(await exit).not.toBe(0);
    expect(stderr).toMatch(/sha256:v1/);
    expect(stderr).toMatch(/sha256:v2/);
    expect(readFileSync(sessionPath, 'utf8')).toBe(v2);
    const after = matter(v2);
    expect(after.data['proposal_status']).toBe('pending');
  });

  it('refuses a stale failure mark the same way', async () => {
    writeFileSync(sessionPath, v2);
    const result = await runCliWithStdin(
      sandbox,
      [
        'session-log',
        'update-proposals',
        sessionPath,
        '--status',
        'failed',
        '--error',
        'boom',
        '--expected-hash',
        'sha256:v1',
      ],
      ''
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      'transcript changed since extraction (expected sha256:v1, found sha256:v2)'
    );
    expect(readFileSync(sessionPath, 'utf8')).toBe(v2);
  });
});
