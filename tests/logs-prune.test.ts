import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanSandbox, makeSandbox, runCli } from './helpers.js';

const exec = promisify(execFile);
const DAY_MS = 24 * 60 * 60 * 1000;

describe('logs prune', () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = makeSandbox();
    await exec('git', ['init', '-q'], { cwd: sandbox });
    await runCli(sandbox, ['init', '--assistants', 'claude']);
  });

  afterEach(() => cleanSandbox(sandbox));

  function plantLog(bucket: string, name: string, ageMs: number, body = 'x'): string {
    const dir = join(sandbox, '.ai/knowledge-base/_logs', bucket);
    mkdirSync(dir, { recursive: true });
    const full = join(dir, name);
    writeFileSync(full, body);
    const past = new Date(Date.now() - ageMs);
    utimesSync(full, past, past);
    return full;
  }

  it('deletes log files older than --older-than and reports per-bucket counts', async () => {
    const old = plantLog('stage-2', 'old.jsonl', 60 * DAY_MS);
    const fresh = plantLog('stage-2', 'fresh.jsonl', 1 * DAY_MS);

    const result = await runCli(sandbox, ['logs', 'prune', '--older-than', '30d']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(result.stdout).toMatch(/Deleted 1 log file/);
    expect(result.stdout).toMatch(/stage-2: 1\/2 eligible/);
  });

  it('honors --dry-run', async () => {
    const old = plantLog('curator', 'old.jsonl', 60 * DAY_MS, 'hello');

    const result = await runCli(sandbox, ['logs', 'prune', '--older-than', '30d', '--dry-run']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(old)).toBe(true);
    expect(result.stdout).toMatch(/Would delete 1 log file/);
    expect(result.stdout).toMatch(/Dry-run:/);
  });

  it('defaults to the settings logsRetentionDays when --older-than is omitted', async () => {
    // The default-init writes logsRetentionDays = 30.
    const old = plantLog('bootstrap-incremental', 'old.jsonl', 60 * DAY_MS);
    const fresh = plantLog('bootstrap-incremental', 'fresh.jsonl', 5 * DAY_MS);

    const result = await runCli(sandbox, ['logs', 'prune']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('fails with a clear message on an invalid duration', async () => {
    const result = await runCli(sandbox, ['logs', 'prune', '--older-than', 'foobar']);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/unrecognized duration/);
  });
});
