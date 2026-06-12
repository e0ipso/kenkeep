import { existsSync } from 'node:fs';
import { log } from '../lib/log.js';
import { pruneLogs } from '../lib/logs-prune.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export async function runLogsPrune(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
  const cutoffMs = Date.now() - settings.logsRetentionDays * 24 * 60 * 60 * 1000;
  const { filesDeleted } = pruneLogs({ logsDir: paths.logsDir, cutoffMs });
  log.info(`pruned ${filesDeleted} files`);
  return 0;
}
