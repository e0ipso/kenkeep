import matter from 'gray-matter';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSessionLog } from '../../src/lib/session-log.js';
import { cliPath } from '../helpers.js';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';

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

function validPayload() {
  return JSON.stringify({
    practice: [
      {
        kind: 'practice',
        tags: ['test'],
        title: 'Test practice',
        summary: 'Test summary',
        body: 'Test body',
        confidence: 'high',
      },
    ],
    map: [],
  });
}

describe('session-log stage-live CLI', () => {
  let sandbox: string;
  let sessionsDir: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kk-session-log-stage-live-'));
    sessionsDir = join(sandbox, '.ai', 'kenkeep', '_sessions');
    mkdirSync(join(sandbox, '.ai', 'kenkeep'), { recursive: true });
    writeFileSync(join(sandbox, '.ai', 'kenkeep', 'config.yaml'), 'schema_version: 1\n');
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it('creates a done session log with valid proposals', async () => {
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--session-id', SESSION_ID],
      validPayload()
    );

    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim()) as {
      path: string;
      session_id: string;
      idempotency: string;
    };
    expect(summary.session_id).toBe(SESSION_ID);
    expect(summary.idempotency).toBe('normal');
    expect(existsSync(summary.path)).toBe(true);

    const parsed = matter(readFileSync(summary.path, 'utf8'));
    expect(parsed.data['proposal_status']).toBe('done');
    expect(parsed.data['captured_by']).toBe('manual');
    expect(parsed.data['session_id']).toBe(SESSION_ID);
    const proposals = parsed.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toHaveLength(1);
  });

  it('updates an existing log by session id', async () => {
    mkdirSync(sessionsDir, { recursive: true });
    const existing = renderSessionLog({
      sessionId: SESSION_ID,
      capturedBy: 'stop',
      capturedAt: '2026-05-11T10:00:00Z',
      transcriptHash: 'sha256:abc',
      body: 'old transcript',
      proposalStatus: 'pending',
    });
    writeFileSync(join(sessionsDir, `20260511-1000-${SESSION_ID}.md`), existing);

    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--session-id', SESSION_ID],
      validPayload()
    );
    expect(result.exitCode).toBe(0);
    const files = readdirSync(sessionsDir).filter(f => f.endsWith(`${SESSION_ID}.md`));
    expect(files).toHaveLength(1);

    const parsed = matter(readFileSync(join(sessionsDir, files[0]!), 'utf8'));
    expect(parsed.data['proposal_status']).toBe('done');
    expect(parsed.data['captured_by']).toBe('manual');
  });

  it('accepts empty-but-valid proposal output', async () => {
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--session-id', SESSION_ID],
      JSON.stringify({ practice: [], map: [] })
    );
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim()) as { path: string };
    const parsed = matter(readFileSync(summary.path, 'utf8'));
    const proposals = parsed.data['proposals'] as { practice: unknown[]; map: unknown[] };
    expect(proposals.practice).toEqual([]);
    expect(proposals.map).toEqual([]);
  });

  it('reports degraded idempotency for generated session id', async () => {
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--generate-session-id'],
      validPayload()
    );
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim()) as {
      session_id: string;
      idempotency: string;
    };
    expect(summary.idempotency).toBe('degraded');
    expect(summary.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('rejects legacy hint fields without writing', async () => {
    const beforeCount = existsSync(sessionsDir) ? readdirSync(sessionsDir).length : 0;
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--session-id', SESSION_ID],
      JSON.stringify({
        practice: [
          {
            kind: 'practice',
            tags: ['test'],
            title: 'Test',
            summary: 'Test summary',
            body: 'Test body',
            confidence: 'high',
            supports_existing_node: 'practice-old',
          },
        ],
        map: [],
      })
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/schema validation/i);
    const afterCount = existsSync(sessionsDir) ? readdirSync(sessionsDir).length : 0;
    expect(afterCount).toBe(beforeCount);
  });

  it('strips private spans from transcript excerpt text', async () => {
    const result = await runCliWithStdin(
      sandbox,
      [
        'session-log',
        'stage-live',
        '--session-id',
        SESSION_ID,
        '--transcript-excerpt',
        'visible <kk-private>secret</kk-private> tail',
      ],
      validPayload()
    );
    expect(result.exitCode).toBe(0);
    const summary = JSON.parse(result.stdout.trim()) as { path: string };
    const log = readFileSync(summary.path, 'utf8');
    expect(log).not.toContain('secret');
    expect(log).toContain('[kk-private removed]');
  });

  it('fails on invalid JSON without writing', async () => {
    const result = await runCliWithStdin(
      sandbox,
      ['session-log', 'stage-live', '--session-id', SESSION_ID],
      'not-json'
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/invalid JSON/i);
  });
});
