import { relative, sep } from 'node:path';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { refreshRenderedLinks } from '../lib/rendered-links.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * Explicit repair for the `stale-rendered-link` lint finding: re-render the
 * generated Related/Citations sections of every leaf whose carried links no
 * longer match the tree (frontmatter bytes untouched), then rebuild the
 * catalogs from the final tree because the refreshed leaves' hashes changed.
 * A tree with no drift is left byte-identical and is not rebuilt. Writes files
 * only; never stages or commits.
 */
export async function runNodeRefreshLinks(): Promise<number> {
  const paths = repoPaths(findRepoRoot());
  let written: string[];
  try {
    written = refreshRenderedLinks(paths.nodesDir);
  } catch (err) {
    // Invalid frontmatter, the old layout and a refused symlinked leaf are all
    // reported the same way; no leaf has been written when any of them throws.
    if (err instanceof Error) {
      log.error(`node refresh-links: ${err.message}`);
      return 1;
    }
    throw err;
  }
  if (written.length === 0) {
    log.success('Rendered links are current. Nothing to refresh.');
    return 0;
  }
  for (const file of written) {
    log.plain(`refreshed ${relative(paths.nodesDir, file).split(sep).join('/')}`);
  }
  log.success(`Refreshed rendered links in ${written.length} leaf/leaves.`);
  return runIndexRebuild();
}
