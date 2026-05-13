import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { QueueFileSchema, type QueueEntry, type QueueFile } from './schemas.js';

export function readQueue(file: string): QueueFile {
  if (!existsSync(file)) return { schema_version: 1, entries: [] };
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const parsed = QueueFileSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { schema_version: 1, entries: [] };
  } catch {
    return { schema_version: 1, entries: [] };
  }
}

/**
 * Appends an entry to the queue file atomically: read, append, write to a
 * temp file, rename. Two interleaved appends from concurrent hooks may
 * still race; in practice Stop/SessionEnd/PreCompact are unlikely to fire
 * simultaneously on the same session, and `hasQueueEntry` prevents a second
 * append for the same session_id.
 */
export function appendToQueue(file: string, entry: QueueEntry): void {
  const queue = readQueue(file);
  queue.entries.push(entry);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(queue, null, 2)}\n`);
  renameSync(tmp, file);
}

export function hasQueueEntry(file: string, sessionId: string): boolean {
  return readQueue(file).entries.some(e => e.session_id === sessionId);
}
