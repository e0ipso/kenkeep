import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_BUCKETS = ['stage-2', 'curator', 'bootstrap-incremental'] as const;
export type LogBucket = (typeof LOG_BUCKETS)[number];

export interface BucketReport {
  bucket: LogBucket;
  filesDeleted: number;
  bytesFreed: number;
  filesScanned: number;
}

export interface PruneResult {
  cutoffMs: number;
  cutoffIso: string;
  totalFilesDeleted: number;
  totalBytesFreed: number;
  buckets: BucketReport[];
  dryRun: boolean;
}

export interface PruneOptions {
  logsDir: string;
  /** Cutoff in ms-since-epoch; files with mtime < cutoff are eligible. */
  cutoffMs: number;
  dryRun?: boolean;
  now?: () => Date;
}

/**
 * Walks each of `LOG_BUCKETS` under `logsDir` and deletes JSONL files whose
 * mtime predates `cutoffMs`. Reports per-bucket counts and freed bytes.
 * `dryRun: true` short-circuits the unlinks — counts and bytes are still
 * accumulated from `statSync`.
 */
export function pruneLogs(opts: PruneOptions): PruneResult {
  const buckets: BucketReport[] = [];
  let totalFiles = 0;
  let totalBytes = 0;
  for (const bucket of LOG_BUCKETS) {
    const dir = join(opts.logsDir, bucket);
    const report: BucketReport = {
      bucket,
      filesDeleted: 0,
      bytesFreed: 0,
      filesScanned: 0,
    };
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.jsonl')) continue;
        const full = join(dir, name);
        let info;
        try {
          info = statSync(full);
        } catch {
          continue;
        }
        if (!info.isFile()) continue;
        report.filesScanned += 1;
        if (info.mtimeMs < opts.cutoffMs) {
          if (!opts.dryRun) {
            try {
              unlinkSync(full);
            } catch {
              continue;
            }
          }
          report.filesDeleted += 1;
          report.bytesFreed += info.size;
        }
      }
    }
    buckets.push(report);
    totalFiles += report.filesDeleted;
    totalBytes += report.bytesFreed;
  }
  return {
    cutoffMs: opts.cutoffMs,
    cutoffIso: new Date(opts.cutoffMs).toISOString(),
    totalFilesDeleted: totalFiles,
    totalBytesFreed: totalBytes,
    buckets,
    dryRun: opts.dryRun === true,
  };
}

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Parses `ms`-package-style duration strings: `30d`, `2w`, `12h`, `45m`,
 * `90s`, `500ms`, `1y`. Returns the duration in milliseconds. Throws on
 * unrecognized or non-positive input.
 */
export function parseDurationMs(input: string): number {
  const trimmed = input.trim().toLowerCase();
  // Tail unit first (allow multi-char "ms"). RegExp is anchored.
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|[smhdwy])$/);
  if (!match) {
    throw new Error(
      `unrecognized duration: ${JSON.stringify(input)}. Expected formats like 30d, 2w, 12h, 45m.`,
    );
  }
  const value = Number(match[1]);
  const unit = match[2]!;
  const factor = DURATION_UNITS[unit];
  if (factor === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`invalid duration: ${JSON.stringify(input)}`);
  }
  return Math.round(value * factor);
}

/**
 * Formats a byte count as a short string (1.2 MB, 999 B). Used for the CLI
 * "freed N bytes" summary; mostly cosmetic.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}
