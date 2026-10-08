import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { atomicWriteFile } from './fs-atomic.js';

const HOST = hostname();
const WAIT_MS = 800;
const EMPTY_LOCK_AGE_MS = 5000;

interface Owner {
  schema_version: 1;
  pid: number;
  host: string;
}

const code = (err: unknown): string | undefined => (err as NodeJS.ErrnoException).code;

function busy(file: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`session log is locked: ${file}`), { code: 'ELOCKED' });
}

function removeEmptyDirectory(dir: string): void {
  try {
    rmdirSync(dir);
  } catch (err) {
    // A different owner may have acquired it meanwhile. Never remove its files.
    if (code(err) !== 'ENOENT' && code(err) !== 'ENOTEMPTY') throw err;
  }
}

/** Reclaim only a dead local owner, or an old directory with no files at all. */
function reclaim(dir: string): void {
  try {
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    const names = readdirSync(dir);
    if (names.length === 0) {
      if (Date.now() - stat.mtimeMs >= EMPTY_LOCK_AGE_MS) removeEmptyDirectory(dir);
      return;
    }
    const name = names[0];
    if (names.length !== 1 || !name?.startsWith('owner-') || !name.endsWith('.json')) return;
    const path = join(dir, name);
    const ownerStat = lstatSync(path);
    if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) return;
    let rawOwner: unknown;
    try {
      rawOwner = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return;
    }
    if (rawOwner === null || typeof rawOwner !== 'object') return;
    const owner = rawOwner as Partial<Owner>;
    if (
      owner.schema_version !== 1 ||
      !Number.isSafeInteger(owner.pid) ||
      (owner.pid ?? 0) <= 0 ||
      owner.host !== HOST
    ) {
      return;
    }
    try {
      process.kill(owner.pid as number, 0);
      return; // A stalled live writer still owns its lock, regardless of age.
    } catch (err) {
      if (code(err) !== 'ESRCH') return; // EPERM and unknown errors fail closed.
    }
    // Each acquisition has a unique filename. Two reclaimers cannot unlink a
    // later owner's record, and rmdir refuses a directory that is not empty.
    unlinkSync(path);
    removeEmptyDirectory(dir);
  } catch (err) {
    if (code(err) !== 'ENOENT') throw err;
  }
}

/**
 * Serialize capture and extraction read-check-write operations for one log.
 * A live owner never loses the lock because its event loop or filesystem
 * stalls. Dead local owners are recoverable; a foreign or malformed owner
 * fails closed. Contention gives up within 800 ms so capture stays advisory.
 */
export async function withSessionLogLock<T>(file: string, fn: () => T | Promise<T>): Promise<T> {
  mkdirSync(dirname(file), { recursive: true });
  const dir = `${file}.lock`;
  const ownerName = `owner-${randomUUID()}.json`;
  const ownerPath = join(dir, ownerName);
  const until = Date.now() + WAIT_MS;
  for (;;) {
    let created = false;
    try {
      mkdirSync(dir);
      created = true;
    } catch (err) {
      if (code(err) !== 'EEXIST') throw err;
      reclaim(dir);
    }
    if (created) {
      try {
        const owner: Owner = { schema_version: 1, pid: process.pid, host: HOST };
        atomicWriteFile(ownerPath, JSON.stringify(owner));
        const names = readdirSync(dir);
        // An empty abandoned directory can be reclaimed before publication.
        // Never enter the write section if publication met another owner.
        if (names.length !== 1 || names[0] !== ownerName) throw busy(file);
        return await fn();
      } finally {
        try {
          unlinkSync(ownerPath);
        } catch (err) {
          if (code(err) !== 'ENOENT') throw err;
        }
        removeEmptyDirectory(dir);
      }
    }
    const left = until - Date.now();
    if (left <= 0) throw busy(file);
    await new Promise(resolve => setTimeout(resolve, Math.min(20, left)));
  }
}
