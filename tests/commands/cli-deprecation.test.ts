import { execFile } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliPath } from '../helpers.js';

const exec = promisify(execFile);

/**
 * Spawns the built CLI in `cwd`. Always resolves with stdout/stderr/exit
 * code so commander's nonzero exits do not throw.
 */
async function runCli(
  cwd: string,
  args: string[],
  extraEnv: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await exec('node', [cliPath, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', ...extraEnv },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

/**
 * Builds a sandbox with `.git/` so `findRepoRoot()` succeeds plus a
 * single-script "bin" dir we can drop a fake harness binary into. PATH
 * is amended in the launched env so the launcher exec's the fake.
 */
function makeSandbox(): { root: string; binDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'kb-cli-depr-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  const binDir = join(root, 'bin');
  mkdirSync(binDir, { recursive: true });
  // Fake `claude` binary: prints nothing, exits 0. Resolves the launcher's
  // `close` handler immediately so the CLI returns control to the test.
  const fakeClaude = join(binDir, 'claude');
  writeFileSync(fakeClaude, '#!/usr/bin/env bash\nexit 0\n');
  chmodSync(fakeClaude, 0o755);
  return { root, binDir };
}

describe('bootstrap-incremental deprecation alias', () => {
  let sandbox: { root: string; binDir: string };

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    rmSync(sandbox.root, { recursive: true, force: true });
  });

  it('writes a [deprecated] notice to stderr when invoked', async () => {
    const result = await runCli(
      sandbox.root,
      ['--harness', 'claude', 'bootstrap-incremental'],
      // Put the fake claude binary first on PATH so `spawn('claude', ...)`
      // resolves to a process that exits cleanly.
      { PATH: `${sandbox.binDir}:${process.env['PATH'] ?? ''}` }
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/\[deprecated\]/i);
    expect(result.stderr).toContain('bootstrap-incremental');
    expect(result.stderr).toContain("'ai-knowledge-base bootstrap'");
  });

  it('mentions "deprecated" in `bootstrap-incremental --help`', async () => {
    const result = await runCli(sandbox.root, ['bootstrap-incremental', '--help']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).toContain('deprecated');
  });

  it('does not mention "deprecated" in `bootstrap --help`', async () => {
    const result = await runCli(sandbox.root, ['bootstrap', '--help']);
    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).not.toContain('deprecated');
  });
});
