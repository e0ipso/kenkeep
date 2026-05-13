import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pruneLogs } from '../../src/lib/logs-prune.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('pruneLogs', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kb-prune-'));
  });
  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  function makeLog(bucket: string, name: string, ageMs: number, body = 'x'): string {
    const dir = join(sandbox, bucket);
    mkdirSync(dir, { recursive: true });
    const full = join(dir, name);
    writeFileSync(full, body);
    const past = new Date(Date.now() - ageMs);
    utimesSync(full, past, past);
    return full;
  }

  it('deletes .jsonl files older than the cutoff anywhere under logsDir', () => {
    const old1 = makeLog('proposal', 'old.jsonl', 40 * DAY_MS);
    const fresh1 = makeLog('proposal', 'fresh.jsonl', 1 * DAY_MS);
    const old2 = makeLog('curator', 'old.jsonl', 90 * DAY_MS);
    const old3 = makeLog('bootstrap-incremental', 'old.jsonl', 50 * DAY_MS);
    const oldNested = makeLog('future-bucket/2026', 'old.jsonl', 60 * DAY_MS);

    const result = pruneLogs({
      logsDir: sandbox,
      cutoffMs: Date.now() - 30 * DAY_MS,
    });

    expect(result.filesDeleted).toBe(4);
    expect(existsSync(old1)).toBe(false);
    expect(existsSync(fresh1)).toBe(true);
    expect(existsSync(old2)).toBe(false);
    expect(existsSync(old3)).toBe(false);
    expect(existsSync(oldNested)).toBe(false);
  });

  it('skips non-.jsonl files even when old', () => {
    const other = join(sandbox, 'proposal', 'README.md');
    mkdirSync(join(sandbox, 'proposal'), { recursive: true });
    writeFileSync(other, 'x');
    const past = new Date(Date.now() - 90 * DAY_MS);
    utimesSync(other, past, past);

    const result = pruneLogs({
      logsDir: sandbox,
      cutoffMs: Date.now() - 30 * DAY_MS,
    });

    expect(result.filesDeleted).toBe(0);
    expect(existsSync(other)).toBe(true);
  });

  it('returns zero when logsDir does not exist', () => {
    const result = pruneLogs({
      logsDir: join(sandbox, 'does-not-exist'),
      cutoffMs: Date.now() - 30 * DAY_MS,
    });
    expect(result.filesDeleted).toBe(0);
  });
});
