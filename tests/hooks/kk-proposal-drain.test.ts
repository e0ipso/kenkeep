import matter from 'gray-matter';
import { execFile, spawn } from 'node:child_process';
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

  it('cursor drain detaches: the hook returns before the headless run finishes, the child still drains', async () => {
    if (process.platform === 'win32') return;
    const cursorHookPath = join(repoRoot, 'dist/hooks/cursor/kk-proposal-drain.cjs');
    const file = seedSession(sandbox, 'detach-pending');

    // Stub `agent` binary that takes 3s and fails: long enough to prove the
    // hook did not wait for it, failing so the child marks the log failed.
    const stubDir = join(sandbox, 'stub-bin');
    mkdirSync(stubDir, { recursive: true });
    writeFileSync(join(stubDir, 'agent'), '#!/bin/sh\nsleep 3\nexit 1\n', { mode: 0o755 });
    const env = { PATH: `${stubDir}:${dirname(process.execPath)}:/usr/bin` };

    const started = Date.now();
    const hookResult = await new Promise<SpawnResult>(resolveFn => {
      const proc = execFile(
        process.execPath,
        [cursorHookPath],
        { cwd: sandbox, env: { ...process.env, NO_COLOR: '1', ...env } },
        (err, stdout, stderr) => {
          resolveFn({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: err ? 1 : 0,
          });
        }
      );
      proc.stdin?.write(JSON.stringify({ workspace_roots: [sandbox] }));
      proc.stdin?.end();
    });
    const hookMs = Date.now() - started;

    expect(hookResult.exitCode).toBe(0);
    // The stub takes 3s; a non-detached drain would block at least that long.
    expect(hookMs).toBeLessThan(2500);

    // The detached child runs the drain to completion in the background.
    const logFile = join(sandbox, '.ai/kenkeep/_sessions', file);
    let status = '';
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      status = matter(readFileSync(logFile, 'utf8')).data['proposal_status'] as string;
      if (status !== 'pending') break;
      await new Promise(r => setTimeout(r, 250));
    }
    expect(status).toBe('failed');
  }, 30_000);
});

/**
 * Harness-agnostic regression for the async hook launcher (plan 52 / issue #52).
 *
 * Confirmed root cause (reproduced against the pre-fix code): `runHookEntry`
 * (src/lib/hook-entry.ts) awaited an unbounded stdin read BEFORE re-spawning the
 * detached worker, and that read (src/lib/stdin.ts) resolved only on stdin
 * 'end'/'error' (or immediately when isTTY). When a host spawns the hook with
 * its stdin held open and never sends EOF, the parent blocked in the read, never
 * reached the detach, and was killed by the host's hook timeout before it could
 * free the slot. This is a property of the launch path, not of any single
 * harness: Codex, Cursor, and Copilot route through the identical launcher path.
 *
 * The fix (async launcher, src/lib/async-launcher.ts) launches the detached
 * worker before any host-dependent or unbounded operation — only a hard-bounded
 * payload capture precedes it — so the parent frees the slot regardless of the
 * host's stdin/timeout behavior.
 *
 * These cases assert that invariant: the parent frees the host slot before a
 * bounded timeout while the drain completes in a detached child. The
 * fast-return-with-completed-work assertion prevents a "return fast but skip the
 * drain" regression from making them green falsely.
 */
describe('kk-proposal-drain launch path: held-open stdin without EOF', () => {
  const harnesses = [
    { name: 'codex', binary: 'codex', payload: (s: string) => ({ cwd: s }) },
    { name: 'cursor', binary: 'agent', payload: (s: string) => ({ workspace_roots: [s] }) },
    { name: 'copilot', binary: 'copilot', payload: (s: string) => ({ cwd: s }) },
  ] as const;

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

  describe.each(harnesses)('$name detach-reliant harness', ({ name, binary, payload }) => {
    it('frees the host slot before EOF and still drains in a detached child', async () => {
      if (process.platform === 'win32') return;
      const drainHook = join(repoRoot, `dist/hooks/${name}/kk-proposal-drain.cjs`);
      expect(existsSync(drainHook)).toBe(true);
      const file = seedSession(sandbox, `${name}-held-open`);

      // Failing stub named after the harness binary: sleeps 3s (long enough to
      // prove the parent did not wait for it) then exits non-zero (so the
      // detached child marks the pending log 'failed' — observable completion).
      const stubDir = join(sandbox, `stub-${name}`);
      mkdirSync(stubDir, { recursive: true });
      writeFileSync(join(stubDir, binary), '#!/bin/sh\nsleep 3\nexit 1\n', { mode: 0o755 });
      const env = { PATH: `${stubDir}:${dirname(process.execPath)}:/usr/bin` };

      // Stands in for a real host hook timeout (Codex uses 30s; we bound far
      // tighter so the block surfaces quickly).
      const HOST_TIMEOUT_MS = 2500;
      const start = Date.now();
      const child = spawn(process.execPath, [drainHook], {
        cwd: sandbox,
        env: { ...process.env, NO_COLOR: '1', ...env },
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      // Write the payload but NEVER end stdin: emulate a host that holds the
      // hook's stdin open without sending EOF.
      child.stdin.write(JSON.stringify(payload(sandbox)));

      const exitedBeforeTimeout = await new Promise<boolean>(res => {
        const timer = setTimeout(() => res(false), HOST_TIMEOUT_MS);
        child.on('exit', () => {
          clearTimeout(timer);
          res(true);
        });
      });
      const parentMs = Date.now() - start;
      if (!exitedBeforeTimeout) {
        try {
          child.kill('SIGKILL');
        } catch {
          // already gone
        }
      }

      // Invariant: the parent frees the host slot before the timeout.
      expect(exitedBeforeTimeout).toBe(true);
      expect(parentMs).toBeLessThan(HOST_TIMEOUT_MS);

      // Not a fast return that skips work: the detached child drains to
      // completion in the background (failing stub => 'failed').
      const logFile = join(sandbox, '.ai/kenkeep/_sessions', file);
      let status = '';
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        status = matter(readFileSync(logFile, 'utf8')).data['proposal_status'] as string;
        if (status !== 'pending') break;
        await new Promise(r => setTimeout(r, 250));
      }
      expect(status).toBe('failed');
    }, 30_000);
  });
});
