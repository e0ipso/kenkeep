import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireLock, readState, releaseLock, writeState } from '../../src/lib/state.js';

describe('state.json lock', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kb-state-'));
    file = join(dir, '.kb-builder', 'state.json');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('returns schema_version stub when file is missing', () => {
    expect(readState(file)).toEqual({ schema_version: 1 });
  });

  it('acquires a fresh lock and writes it to disk', () => {
    const now = new Date('2026-05-11T10:00:00Z');
    expect(acquireLock(file, { name: 'stage2-drain', pid: 1234, now })).toBe(true);
    const onDisk = JSON.parse(readFileSync(file, 'utf8'));
    expect(onDisk.schema_version).toBe(1);
    expect(onDisk.lock.name).toBe('stage2-drain');
    expect(onDisk.lock.pid).toBe(1234);
    expect(onDisk.lock.acquired_at).toBe('2026-05-11T10:00:00.000Z');
  });

  it('rejects acquisition by a different live pid', () => {
    const t0 = new Date('2026-05-11T10:00:00Z');
    expect(acquireLock(file, { name: 'stage2-drain', pid: 1234, now: t0 })).toBe(true);
    expect(
      acquireLock(file, {
        name: 'stage2-drain',
        pid: 9999,
        now: new Date('2026-05-11T10:01:00Z'),
      }),
    ).toBe(false);
  });

  it('treats a lock older than its ttl as stale and overwrites it', () => {
    const t0 = new Date('2026-05-11T10:00:00Z');
    acquireLock(file, { name: 'stage2-drain', pid: 1234, now: t0, ttlMs: 60_000 });
    const later = new Date('2026-05-11T10:05:00Z');
    expect(acquireLock(file, { name: 'stage2-drain', pid: 5555, now: later, ttlMs: 60_000 })).toBe(
      true,
    );
    expect(readState(file).lock?.pid).toBe(5555);
  });

  it('releases only when name and pid match', () => {
    const now = new Date('2026-05-11T10:00:00Z');
    acquireLock(file, { name: 'stage2-drain', pid: 1234, now });
    releaseLock(file, 'curator', 1234);
    expect(readState(file).lock?.pid).toBe(1234);
    releaseLock(file, 'stage2-drain', 1234);
    expect(readState(file).lock).toBeNull();
  });

  it('preserves last_nudged_at across lock cycles', () => {
    writeState(file, {
      schema_version: 1,
      last_nudged_at: '2026-05-11T09:00:00Z',
    });
    const now = new Date('2026-05-11T10:00:00Z');
    acquireLock(file, { name: 'stage2-drain', pid: 1234, now });
    releaseLock(file, 'stage2-drain', 1234);
    expect(readState(file).last_nudged_at).toBe('2026-05-11T09:00:00Z');
  });
});
