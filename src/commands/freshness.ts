import { log } from '../lib/log.js';
import { computeFreshness, type FreshnessReport } from '../lib/freshness.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';

export interface FreshnessOptions {
  verbose?: boolean;
}

/**
 * Read-only, advisory freshness report: how many nodes may describe source code
 * that changed since the node was last curated. Never writes to `nodes/`, never
 * calls the LLM, and always exits 0 — flagged nodes are informational, not an
 * error. Degrades to a clean "no signal" line when git history is unavailable.
 */
export async function runFreshness(opts: FreshnessOptions = {}): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  const report = computeFreshness({ root, nodesDir: paths.nodesDir });
  renderFreshness(report, { verbose: opts.verbose ?? false });
  return 0;
}

/** Deterministic renderer for a freshness report (no timestamps, stable order). */
export function renderFreshness(report: FreshnessReport, opts: { verbose: boolean }): void {
  if (!report.available) {
    log.plain(
      'kenkeep freshness: no signal (not a git repository with history, or the knowledge base is empty).'
    );
    return;
  }

  if (report.flaggedCount === 0) {
    log.success(
      `All ${report.consideredNodes} node(s) appear fresh: none reference code that changed since curation.`
    );
    return;
  }

  log.warn(
    `${report.flaggedCount} of ${report.consideredNodes} node(s) may describe code that changed since curation.`
  );
  log.plain('');
  log.plain('By branch:');
  for (const { branch, flagged } of report.perBranch) {
    log.plain(`  ${branch}: ${flagged}`);
  }

  if (opts.verbose) {
    log.plain('');
    log.plain('Flagged nodes:');
    for (const node of report.flagged) {
      log.plain(`  ${node.id} — changed: ${node.changedPaths.join(', ')}`);
    }
  } else {
    log.plain('');
    log.plain('Re-run with --verbose to list the flagged nodes and the paths that changed.');
  }
}
