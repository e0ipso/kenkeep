import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pruneLogs } from '../src/lib/logs-prune.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('pruneLogs', () => {
  let sandbox: string;
  let logsDir: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'kb-logs-prune-'));
    logsDir = join(sandbox, '_logs');
    mkdirSync(join(logsDir, 'proposal'), { recursive: true });
  });

  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  it('deletes jsonl files older than the cutoff and leaves fresh and non-jsonl files alone', () => {
    const now = Date.now();
    const oldFile = join(logsDir, 'proposal', 'old.jsonl');
    const newFile = join(logsDir, 'proposal', 'new.jsonl');
    const nonJsonl = join(logsDir, 'proposal', 'notes.txt');
    writeFileSync(oldFile, 'old');
    writeFileSync(newFile, 'new');
    writeFileSync(nonJsonl, 'keep me');
    const past = new Date(now - 31 * DAY_MS);
    utimesSync(oldFile, past, past);

    const result = pruneLogs({ logsDir, cutoffMs: now - 30 * DAY_MS });

    expect(result).toEqual({ filesDeleted: 1 });
    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(newFile)).toBe(true);
    expect(existsSync(nonJsonl)).toBe(true);
  });
});
