import { existsSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { log } from '../lib/log.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { refreshRenderedLinks } from '../lib/rendered-links.js';
import { preflightIndexRebuild, runIndexRebuild } from './index-rebuild.js';

/**
 * Explicit repair for the `stale-rendered-link` lint finding: re-render the
 * generated Related/Citations sections of every leaf whose carried links no
 * longer match the tree (frontmatter bytes untouched), then rebuild the
 * catalogs from the final tree because the refreshed leaves' hashes changed.
 * A tree with no drift is left byte-identical and is not rebuilt. Writes files
 * only; never stages or commits.
 *
 * The rebuild's known refusals (an uninitialized repo, a malformed project
 * config or AGENTS.md pointer block) are checked before any leaf is written,
 * and a leaf with ambiguous section markers refuses the whole refresh, so a
 * refusal never arrives after leaves already changed.
 */
export async function runNodeRefreshLinks(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }
  let written: string[];
  try {
    preflightIndexRebuild(root);
    written = refreshRenderedLinks(paths.nodesDir, undefined, { refuseMalformed: true });
  } catch (err) {
    // A rebuild preflight refusal, invalid frontmatter, the old layout,
    // ambiguous section markers and a refused symlinked leaf are all reported
    // the same way; no leaf has been written when any of them throws.
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
