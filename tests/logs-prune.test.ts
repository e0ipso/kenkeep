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

  it('deletes .jsonl files older than the configured retention and prints the count', async () => {
    const old = plantLog('proposal', 'old.jsonl', 60 * DAY_MS);
    const fresh = plantLog('proposal', 'fresh.jsonl', 1 * DAY_MS);

    const result = await runCli(sandbox, ['logs', 'prune']);
    expect(result.exitCode).toBe(0);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(result.stdout).toMatch(/pruned 1 files/);
  });
});
