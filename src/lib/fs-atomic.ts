import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ZodType } from 'zod';

export function atomicWriteJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

/**
 * Atomically writes a string to `file`: ensures the parent directory exists,
 * writes to a tmp sibling, then renames into place so an interrupted run never
 * leaves a partially written file. Mirrors the leaf-write pattern in
 * `nodes.ts` for callers (e.g. treeify) that already hold serialized content.
 */
export function atomicWriteFile(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
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
