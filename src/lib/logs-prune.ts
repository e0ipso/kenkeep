import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Recursively walks `logsDir` and deletes `*.jsonl` files whose mtime
 * predates `cutoffMs`. Per-file errors are swallowed so a single unreadable
 * entry does not abort the sweep.
 */
export function pruneLogs(opts: { logsDir: string; cutoffMs: number }): { filesDeleted: number } {
  let filesDeleted = 0;
  if (!existsSync(opts.logsDir)) return { filesDeleted };
  const walk = (dir: string): void => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      let info;
      try {
        info = statSync(full);
      } catch {
        continue;
      }
      if (info.mtimeMs >= opts.cutoffMs) continue;
      try {
        unlinkSync(full);
        filesDeleted += 1;
      } catch {
        /* ignore */
      }
    }
  };
  walk(opts.logsDir);
  return { filesDeleted };
}
