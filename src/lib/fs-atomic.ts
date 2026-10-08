import { randomBytes } from 'node:crypto';
import {
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { ZodType } from 'zod';

/**
 * The one atomic writer for every kenkeep state file. Ensures the parent
 * directory exists, writes `content` (string or verbatim Buffer bytes) to a
 * sibling temp file unique to this process and call
 * (`<file>.<pid>.<random>.tmp`), then renames it over `file`. Readers therefore
 * see either the old or the new file, never a truncated one, and concurrent
 * writers (e.g. simultaneous hook processes) never steal each other's temp
 * file; the last rename wins. The temp file is removed on any failure, and the
 * original error is rethrown so each caller keeps its own error behavior.
 * Deliberately lock-free: atomic replacement does not order competing writers.
 */
export function atomicWriteFile(file: string, content: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let renamed = false;
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, file);
    renamed = true;
  } finally {
    if (!renamed) rmSync(tmp, { force: true });
  }
}

export function atomicWriteJson(file: string, data: unknown): void {
  atomicWriteFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function readJsonValidated<T>(file: string, schema: ZodType<T>, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return fallback;
  } catch {
    return fallback;
  }
}

export function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

/**
 * Copies each top-level entry of `src` (only `names`, when given) into `dest`
 * when `dest` lacks it. Never overwrites, so local edits survive; a name `src`
 * does not ship is skipped. Returns the names it copied.
 *
 * A destination entry counts as present even when it is a dangling symlink,
 * and the top-level create is exclusive, so an entry that appears between the
 * check and the copy is left alone too.
 */
export function copyMissingEntries(src: string, dest: string, names?: readonly string[]): string[] {
  if (!existsSync(src)) return [];
  const copied: string[] = [];
  for (const name of names ?? readdirSync(src)) {
    const from = join(src, name);
    const to = join(dest, name);
    if (!existsSync(from) || pathEntryExists(to)) continue;
    mkdirSync(dest, { recursive: true });
    if (copyEntryExclusive(from, to)) copied.push(name);
  }
  return copied;
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Creates `to` from `from` without replacing anything; false when `to` already exists. */
function copyEntryExclusive(from: string, to: string): boolean {
  try {
    const stat = lstatSync(from);
    if (stat.isDirectory()) {
      mkdirSync(to);
      cpSync(from, to, { recursive: true, force: false, errorOnExist: true });
    } else if (stat.isFile()) {
      copyFileSync(from, to, constants.COPYFILE_EXCL);
    } else {
      cpSync(from, to, { force: false, errorOnExist: true });
    }
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST' || code === 'ERR_FS_CP_EEXIST') return false;
    throw error;
  }
}
