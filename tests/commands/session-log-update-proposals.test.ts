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
        secretScanStatus: 'clean',
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
          kind: 'practice',
          tags: ['test'],
          title: 'Test',
          summary: 'Test summary',
          body: 'Test body',
          confidence: 'high',
        },
      ],
      map: [],
    });

    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'update-proposals', sessionPath, '--status', 'done'],
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
      ['session-log', 'update-proposals', sessionPath, '--status', 'done'],
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
