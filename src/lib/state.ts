import { atomicWriteJson, readJsonValidated } from './fs-atomic.js';
import { StateFileSchema, type StateFile, type StateLock } from './schemas.js';

export const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;

export function readState(file: string): StateFile {
  return readJsonValidated(file, StateFileSchema, { schema_version: 1 });
}

export function writeState(file: string, state: StateFile): void {
  atomicWriteJson(file, state);
}

export interface LockOptions {
  name: string;
  pid: number;
  now: Date;
  ttlMs?: number;
}

/**
 * Attempts to acquire the named lock. Returns true if the caller now holds
 * the lock, false if another live process holds it. A lock whose age exceeds
 * its TTL is treated as stale and overwritten.
 */
export function acquireLock(file: string, opts: LockOptions): boolean {
  const state = readState(file);
  const existing = state.lock ?? null;
  const ttlMs = opts.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const nowMs = opts.now.getTime();
  if (existing) {
    const acquiredMs = Date.parse(existing.acquired_at);
    const age = Number.isFinite(acquiredMs) ? nowMs - acquiredMs : Number.POSITIVE_INFINITY;
    const expired = age > existing.ttl_ms;
    if (!expired && existing.pid !== opts.pid) {
      return false;
    }
  }
  const lock: StateLock = {
    name: opts.name,
    pid: opts.pid,
    acquired_at: opts.now.toISOString(),
    ttl_ms: ttlMs,
  };
  writeState(file, { ...state, lock });
  return true;
}

export function releaseLock(file: string, name: string, pid: number): void {
  const state = readState(file);
  if (!state.lock) return;
  if (state.lock.name !== name || state.lock.pid !== pid) return;
  const next: StateFile = { ...state, lock: null };
  writeState(file, next);
}
