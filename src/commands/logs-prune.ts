import { existsSync } from 'node:fs';
import { log } from '../lib/log.js';
import { LOG_BUCKETS, formatBytes, parseDurationMs, pruneLogs } from '../lib/logs-prune.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export interface LogsPruneOptions {
  olderThan?: string;
  dryRun?: boolean;
}

export async function runLogsPrune(opts: LogsPruneOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  ensureStateLayout(paths);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.',
    );
    return 1;
  }

  const { settings, warnings } = resolveSettings({ projectFile: paths.projectConfigFile });
  for (const w of warnings) log.warn(w);

  // Default to settings.logsRetentionDays when --older-than is not given.
  const olderThan = opts.olderThan ?? `${settings.logsRetentionDays}d`;
  let durationMs: number;
  try {
    durationMs = parseDurationMs(olderThan);
  } catch (err) {
    log.error((err as Error).message);
    return 1;
  }

  const now = Date.now();
  const cutoffMs = now - durationMs;

  const result = pruneLogs({
    logsDir: paths.logsDir,
    cutoffMs,
    ...(opts.dryRun ? { dryRun: true } : {}),
  });

  const action = result.dryRun ? 'Would delete' : 'Deleted';
  log.info(
    `${action} ${result.totalFilesDeleted} log file(s) older than ${olderThan} (${result.cutoffIso}).`,
  );
  for (const bucket of result.buckets) {
    log.plain(
      `  • ${bucket.bucket}: ${bucket.filesDeleted}/${bucket.filesScanned} eligible — ${formatBytes(
        bucket.bytesFreed,
      )}`,
    );
  }
  log.plain('');
  log.success(
    `${result.dryRun ? 'Dry-run: ' : ''}freed ${formatBytes(result.totalBytesFreed)} across ${
      LOG_BUCKETS.length
    } bucket(s).`,
  );
  return 0;
}
