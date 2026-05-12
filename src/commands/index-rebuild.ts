import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { generateGraph, generateIndex, writeGraph, writeIndex } from '../lib/index-gen.js';
import { log } from '../lib/log.js';
import { computeNodesHash } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { IndexFrontmatterSchema } from '../lib/schemas.js';
import { resolveSettings } from '../lib/settings.js';

export interface IndexRebuildOptions {
  budgetTokens?: number;
  /** When true, `git add` INDEX.md and GRAPH.md after writing them. */
  stage?: boolean;
}

/**
 * Thin wrapper around the deterministic `generateIndex` / `generateGraph`
 * helpers. The curator and `node add` already regenerate INDEX/GRAPH; this
 * command exists for hand-edits and for the lint-staged pre-commit step,
 * which runs `index-rebuild --stage` so INDEX.md/GRAPH.md land in the same
 * commit as any `nodes/` change.
 */
export async function runIndexRebuild(opts: IndexRebuildOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'ai-knowledge-base is not initialized in this repo. Run `ai-knowledge-base init --assistants claude`.'
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

  const indexFile = join(paths.kbDir, 'INDEX.md');
  const graphFile = join(paths.kbDir, 'GRAPH.md');

  if (opts.stage && !nodesHashChanged(indexFile, paths.nodesDir)) {
    log.success('INDEX.md/GRAPH.md already match nodes/ — nothing to do.');
    return 0;
  }

  const index = generateIndex(paths.nodesDir, genOpts);
  writeIndex(indexFile, index);
  const graph = generateGraph(paths.nodesDir, { now: genOpts.now });
  writeGraph(graphFile, graph);

  log.success(
    `Regenerated INDEX.md and GRAPH.md from ${index.nodeCount} node(s)` +
      (index.hiddenByBudget > 0
        ? ` (${index.hiddenByBudget} hidden by token budget; see GRAPH.md for the full list)`
        : '') +
      '.'
  );

  if (opts.stage) {
    stageIfInGitRepo(root, indexFile, graphFile);
  }

  return 0;
}

/**
 * Returns true if the recorded `nodes_hash` in INDEX.md doesn't match the
 * live hash of `nodes/`. Returns true if INDEX.md is missing or unreadable
 * (force a regenerate). Used to short-circuit `--stage` when nothing changed.
 */
function nodesHashChanged(indexFile: string, nodesDir: string): boolean {
  if (!existsSync(indexFile)) return true;
  try {
    const parsed = matter(readFileSync(indexFile, 'utf8'));
    const fm = IndexFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) return true;
    const recorded = fm.data.nodes_hash.startsWith('sha256:')
      ? fm.data.nodes_hash.slice(7)
      : fm.data.nodes_hash;
    return recorded !== computeNodesHash(nodesDir);
  } catch {
    return true;
  }
}

function stageIfInGitRepo(root: string, ...files: string[]): void {
  if (!isInsideGitRepo(root)) {
    log.plain('--stage: not inside a git repo, skipping `git add`.');
    return;
  }
  try {
    execFileSync('git', ['add', '--', ...files], { cwd: root, stdio: 'pipe' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`--stage: \`git add\` failed: ${message}`);
  }
}

function isInsideGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
