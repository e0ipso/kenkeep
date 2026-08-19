import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '..');
export const cliPath = join(repoRoot, 'dist/cli.js');

export function makeSandbox(prefix = 'ai-kk-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanSandbox(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawns the built CLI in `cwd` with the given args. Captures stdout/stderr
 * regardless of exit code (commander uses non-zero exits in some paths).
 * `env` entries are merged over the inherited environment.
 */
export async function runCli(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = {}
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await exec('node', [cliPath, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', ...env },
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
 * The launch binary every adapter shells out to for its "CLI on PATH"
 * doctor probe. One stub per harness so the suite never depends on a real
 * harness binary — the parity rule: no adapter is a more equal citizen in
 * CI than the others.
 */
const HARNESS_BINARIES = ['claude', 'codex', 'agent', 'opencode', 'copilot', 'kiro-cli-chat'] as const;

/**
 * Writes a stub executable per harness binary into `<dir>/bin`, each
 * answering `--version` with a plausible string and failing any other
 * invocation. Returns the bin dir to prepend to PATH.
 */
export function writeHarnessBinaryStubs(dir: string): string {
  const binDir = join(dir, 'bin');
  mkdirSync(binDir, { recursive: true });
  for (const name of HARNESS_BINARIES) {
    const script = [
      '#!/bin/sh',
      `if [ "$1" = "--version" ]; then echo "${name} 0.0.0-stub"; exit 0; fi`,
      'exit 1',
      '',
    ].join('\n');
    writeFileSync(join(binDir, name), script, { mode: 0o755 });
  }
  return binDir;
}
