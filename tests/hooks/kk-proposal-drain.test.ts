import matter from 'gray-matter';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderSessionLog } from '../../src/lib/session-log.js';
import { cleanSandbox, makeSandbox, runCli } from '../helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const hookPath = join(repoRoot, 'dist/hooks/claude/kk-proposal-drain.cjs');

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runHook(cwd: string, input: object, env: NodeJS.ProcessEnv = {}): Promise<SpawnResult> {
  return new Promise(resolveFn => {
    const proc = execFile(
      'node',
      [hookPath],
      { cwd, env: { ...process.env, NO_COLOR: '1', ...env } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as { code?: unknown }).code === 'number'
            ? ((err as { code: number }).code as number)
            : err
              ? 1
              : 0;
        resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
      }
    );
    proc.stdin?.write(JSON.stringify(input));
    proc.stdin?.end();
  });
}

function seedSession(sandbox: string, sessionId: string): string {
  const sessionsDir = join(sandbox, '.ai/kenkeep/_sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const filename = `${sessionId}.md`;
  writeFileSync(
    join(sessionsDir, filename),
    renderSessionLog({
      sessionId,
      capturedBy: 'stop',
      capturedAt: '2026-05-11T10:00:00Z',
      transcriptHash: 'sha256:abc',
      secretScanStatus: 'clean',
      body: '[USER]: use bravo_pii.cache for PII\n[AGENT]: ok',
    })
  );
  return filename;
}

describe('kk-proposal-drain hook (spawned)', () => {
  let sandbox: string;
  beforeEach(async () => {
    sandbox = makeSandbox();
    const { execFile: ef } = await import('node:child_process');
    await new Promise<void>((res, rej) =>
      ef('git', ['init', '-q'], { cwd: sandbox }, err => (err ? rej(err) : res()))
    );
    await runCli(sandbox, ['init', '--harnesses', 'claude']);
  });
  afterEach(() => cleanSandbox(sandbox));

  it('exits silently with KENKEEP_BUILDER_INTERNAL=1 (recursion guard)', async () => {
    const file = seedSession(sandbox, 'guarded');
    const result = await runHook(sandbox, { cwd: sandbox }, { KENKEEP_BUILDER_INTERNAL: '1' });
    expect(result.exitCode).toBe(0);
    const after = matter(readFileSync(join(sandbox, '.ai/kenkeep/_sessions', file), 'utf8'));
    expect(after.data['proposal_status']).toBe('pending');
  });

  it('returns early in Claude sessions without processing pending logs', async () => {
    const file = seedSession(sandbox, 'pending-only');
    const hookResult = await runHook(sandbox, { cwd: sandbox });
    expect(hookResult.exitCode).toBe(0);
    expect(hookResult.stderr).not.toContain('Draining queue');

    const after = matter(readFileSync(join(sandbox, '.ai/kenkeep/_sessions', file), 'utf8'));
    expect(after.data['proposal_status']).toBe('pending');
  });

  it('returns early when cursor agent binary is not on PATH', async () => {
    if (process.platform === 'win32') return;
    const cursorHookPath = join(repoRoot, 'dist/hooks/cursor/kk-proposal-drain.cjs');
    expect(existsSync(cursorHookPath)).toBe(true);

    const file = seedSession(sandbox, 'cursor-pending');
    // Keep node and `which` on PATH but exclude harness CLIs like `agent`.
    const nodeBin = dirname(process.execPath);
    const pathForHook = `${nodeBin}:/usr/bin`;

    const hookResult = await new Promise<SpawnResult>(resolveFn => {
      const proc = execFile(
        process.execPath,
        [cursorHookPath],
        { cwd: sandbox, env: { ...process.env, NO_COLOR: '1', PATH: pathForHook } },
        (err, stdout, stderr) => {
          const code =
            err && typeof (err as { code?: unknown }).code === 'number'
              ? ((err as { code: number }).code as number)
              : err
                ? 1
                : 0;
          resolveFn({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: code });
        }
      );
      proc.stdin?.write(JSON.stringify({ workspace_roots: [sandbox] }));
      proc.stdin?.end();
    });

    expect(hookResult.exitCode).toBe(0);
    expect(hookResult.stderr).not.toContain('Draining queue');
    const after = matter(readFileSync(join(sandbox, '.ai/kenkeep/_sessions', file), 'utf8'));
    expect(after.data['proposal_status']).toBe('pending');
  });

  it('exits 0 when the repo has no installed-version marker', async () => {
    const empty = makeSandbox();
    try {
      const result = await runHook(empty, { cwd: empty });
      expect(result.exitCode).toBe(0);
    } finally {
      cleanSandbox(empty);
    }
  });
});
