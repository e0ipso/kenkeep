import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatBytes, parseDurationMs, pruneLogs } from '../../src/lib/logs-prune.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('parseDurationMs', () => {
  it('parses days', () => {
    expect(parseDurationMs('30d')).toBe(30 * DAY_MS);
  });
  it('parses weeks', () => {
    expect(parseDurationMs('2w')).toBe(14 * DAY_MS);
  });
  it('parses hours', () => {
    expect(parseDurationMs('12h')).toBe(12 * 60 * 60 * 1000);
  });
  it('parses minutes', () => {
    expect(parseDurationMs('5m')).toBe(5 * 60 * 1000);
  });
  it('parses seconds', () => {
    expect(parseDurationMs('30s')).toBe(30 * 1000);
  });
  it('parses ms', () => {
    expect(parseDurationMs('500ms')).toBe(500);
  });
  it('parses years', () => {
    expect(parseDurationMs('1y')).toBe(365 * DAY_MS);
  });
  it('throws on bad input', () => {
    expect(() => parseDurationMs('30')).toThrow();
    expect(() => parseDurationMs('abc')).toThrow();
    expect(() => parseDurationMs('0d')).toThrow();
    expect(() => parseDurationMs('-1d')).toThrow();
    expect(() => parseDurationMs('30x')).toThrow();
  });
  it('is case-insensitive and whitespace-tolerant', () => {
    expect(parseDurationMs(' 30D ')).toBe(30 * DAY_MS);
  });
});

describe('formatBytes', () => {
  it('uses bytes below 1024', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });
  it('scales through KB/MB/GB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

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

  it('deletes files older than the cutoff in each bucket', () => {
    const old1 = makeLog('stage-2', 'old.jsonl', 40 * DAY_MS);
    const fresh1 = makeLog('stage-2', 'fresh.jsonl', 1 * DAY_MS);
    const old2 = makeLog('curator', 'old.jsonl', 90 * DAY_MS);
    const old3 = makeLog('bootstrap-incremental', 'old.jsonl', 50 * DAY_MS);

    const result = pruneLogs({
      logsDir: sandbox,
      cutoffMs: Date.now() - 30 * DAY_MS,
    });

    expect(result.totalFilesDeleted).toBe(3);
    expect(existsSync(old1)).toBe(false);
    expect(existsSync(fresh1)).toBe(true);
    expect(existsSync(old2)).toBe(false);
    expect(existsSync(old3)).toBe(false);

    const stage2 = result.buckets.find((b) => b.bucket === 'stage-2');
    expect(stage2?.filesDeleted).toBe(1);
    expect(stage2?.filesScanned).toBe(2);
  });

  it('respects --dry-run: deletes nothing but reports counts', () => {
    const old1 = makeLog('stage-2', 'old.jsonl', 40 * DAY_MS, 'aaaa');

    const result = pruneLogs({
      logsDir: sandbox,
      cutoffMs: Date.now() - 30 * DAY_MS,
      dryRun: true,
    });

    expect(existsSync(old1)).toBe(true);
    expect(result.totalFilesDeleted).toBe(1);
    expect(result.totalBytesFreed).toBe(4);
    expect(result.dryRun).toBe(true);
  });

  it('skips non-.jsonl files', () => {
    const other = join(sandbox, 'stage-2', 'README.md');
    mkdirSync(join(sandbox, 'stage-2'), { recursive: true });
    writeFileSync(other, 'x');
    const past = new Date(Date.now() - 90 * DAY_MS);
    utimesSync(other, past, past);

    const result = pruneLogs({
      logsDir: sandbox,
      cutoffMs: Date.now() - 30 * DAY_MS,
    });

    expect(result.totalFilesDeleted).toBe(0);
    expect(existsSync(other)).toBe(true);
  });

  it('handles missing bucket directories without error', () => {
    const result = pruneLogs({
      logsDir: join(sandbox, 'does-not-exist'),
      cutoffMs: Date.now() - 30 * DAY_MS,
    });
    expect(result.totalFilesDeleted).toBe(0);
    expect(result.buckets).toHaveLength(3);
  });
});
