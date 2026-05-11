import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { ensureStateLayout, findRepoRoot, repoPaths } from '../lib/paths.js';
import { resolveSettings } from '../lib/settings.js';

export interface IndexRebuildOptions {
  budgetTokens?: number;
}

/**
 * Thin wrapper around the deterministic `generateIndex` / `generateGraph`
 * helpers. The curator already regenerates INDEX/GRAPH at the end of every
 * run; this command exists for the case where a contributor edits a node
 * file by hand (or runs `proposals review` and wants to refresh before
 * committing) and wants to refresh the index without a curate pass.
 */
export async function runIndexRebuild(opts: IndexRebuildOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  ensureStateLayout(paths);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.',
    );
    return 1;
  }

  mkdirSync(paths.kbDir, { recursive: true });
  const { settings, warnings } = resolveSettings({ projectFile: paths.projectConfigFile });
  for (const w of warnings) log.warn(w);
  const genOpts: { budgetTokens?: number; now: Date } = {
    now: new Date(),
    budgetTokens: settings.indexBudgetTokens,
  };
  if (opts.budgetTokens !== undefined) genOpts.budgetTokens = opts.budgetTokens;

  const index = generateIndex(paths.nodesDir, genOpts);
  writeIndex(join(paths.kbDir, 'INDEX.md'), index);
  const graph = generateGraph(paths.nodesDir, { now: genOpts.now });
  writeGraph(join(paths.kbDir, 'GRAPH.md'), graph);

  log.success(
    `Regenerated INDEX.md and GRAPH.md from ${index.nodeCount} node(s)` +
      (index.hiddenByBudget > 0
        ? ` (${index.hiddenByBudget} hidden by token budget; see GRAPH.md for the full list)`
        : '') +
      '.',
  );
  return 0;
}
