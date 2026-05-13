import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ZodType } from 'zod';

export function atomicWriteJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
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
