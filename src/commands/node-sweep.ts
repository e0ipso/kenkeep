import { existsSync, rmSync } from 'node:fs';
import { join, posix } from 'node:path';
import { placeLeaf, type PlacementReason, type PlacementResult } from '../lib/leaf-placement.js';
import { log } from '../lib/log.js';
import { readAllNodes, resolveLeafDir, type NodeFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths } from '../lib/paths.js';
import { relocateBytes } from '../lib/rebalance-move.js';
import { runIndexRebuild } from './index-rebuild.js';

/**
 * A placement the sweep can act on. `no-folders` is absent by construction,
 * because it aborts the run before anything is recorded.
 */
type SettledPlacement = Exclude<PlacementResult, { kind: 'no-folders' }>;

/** Why a leaf was deleted. The only condition `placeLeaf` reports unplaceable. */
const UNPLACEABLE_REASON = 'no folder-resolving edges and no tag overlap with any folder';

/** One leaf filed into the folder its own edges and tags named. */
interface SweepRelocation {
  id: string;
  /** POSIX path relative to `nodes/`, before the move. */
  from: string;
  /** POSIX path relative to `nodes/`, after the move. */
  to: string;
  reason: PlacementReason;
}

/** One leaf removed because it matched no folder in the tree. */
interface SweepDeletion {
  id: string;
  /** POSIX path relative to `nodes/`, before the deletion. */
  path: string;
  reason: string;
}

/**
 * The command's stdout contract, one JSON line. `skipped` is present only when
 * the tree has no folder to file into; a normal run omits it.
 */
interface SweepSummary {
  relocated: SweepRelocation[];
  deleted: SweepDeletion[];
  skipped?: 'no-folders';
}

/**
 * Deterministic, LLM-free sweep of the `nodes/` root.
 *
 * A leaf lands at the root when curation declines to pick a folder for it.
 * Session start injects the entry catalog, which lists every root leaf, and no
 * folder `index.md` lists them, so a root leaf costs context in every session
 * on every harness and is reachable only from that catalog. This command
 * empties the root. It runs `placeLeaf` over every root leaf, relocates the
 * placeable ones as byte-stable git renames (ids unchanged, so no redirect is
 * recorded), deletes the ones that match no folder at all, then drives the
 * deterministic index rebuild so the folder indexes, the entry catalog,
 * GRAPH.md and `nodes_hash` regenerate.
 *
 * It writes files only. It never stages, commits, or restores. The human
 * accepts the diff with `git commit` and rejects it with a path-scoped
 * `git restore`, deletions included.
 *
 * A tree with no folders short-circuits before any write, deletion included. A
 * fresh or bootstrap-era tree has nowhere to file anything, and every leaf in
 * it would otherwise look unplaceable.
 */
export async function runNodeSweep(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  let tree: NodeFile[];
  try {
    tree = readAllNodes(paths.nodesDir);
  } catch (err) {
    log.error(`node sweep: ${(err as Error).message}`);
    return 1;
  }

  // `readAllNodes` returns leaves sorted by relPath, so the root leaves, and
  // the summary built from them, come out in a stable order.
  const rootLeaves = tree.filter(leaf => leaf.relDir === '');

  // Decide every placement against this one snapshot, then apply.
  // `applyRebalancePlan` re-reads the tree per operation because each operation
  // reshapes it. A sweep only moves leaves out of the root, so relocating one
  // root leaf changes no other leaf's folder, and it must not change another
  // root leaf's decision mid-run. Deciding first also short-circuits the
  // no-folders case before any write.
  const decisions: Array<{ leaf: NodeFile; placement: SettledPlacement }> = [];
  for (const leaf of rootLeaves) {
    const placement = placeLeaf(leaf.frontmatter, tree, leaf.frontmatter.kk_id);
    if (placement.kind === 'no-folders') {
      writeSummary({ relocated: [], deleted: [], skipped: 'no-folders' });
      return 0;
    }
    decisions.push({ leaf, placement });
  }

  const summary: SweepSummary = { relocated: [], deleted: [] };
  try {
    for (const { leaf, placement } of decisions) {
      if (placement.kind === 'placed') {
        // `placeLeaf` only ever names a folder that already exists in the
        // tree, so this containment check never fires today. It keeps the
        // write inside `nodes/` if that ever stops holding.
        const destDir = resolveLeafDir(paths.nodesDir, placement.folder);
        relocateBytes(leaf.path, join(destDir, leaf.filename));
        summary.relocated.push({
          id: leaf.frontmatter.kk_id,
          from: leaf.relPath,
          to: posix.join(placement.folder, leaf.filename),
          reason: placement.reason,
        });
      } else {
        rmSync(leaf.path);
        summary.deleted.push({
          id: leaf.frontmatter.kk_id,
          path: leaf.relPath,
          reason: UNPLACEABLE_REASON,
        });
      }
    }
  } catch (err) {
    log.error(`node sweep: ${(err as Error).message}`);
    log.error('The sweep stopped partway; review the working tree with `git diff`.');
    return 1;
  }

  if (summary.relocated.length > 0 || summary.deleted.length > 0) {
    const rebuildCode = await runIndexRebuild();
    if (rebuildCode !== 0) {
      log.error('node sweep: index rebuild failed after the sweep; review with `git diff`.');
      return rebuildCode;
    }
  }

  writeSummary(summary);
  return 0;
}

/**
 * Machine-readable contract: exactly the JSON summary on stdout. Uses
 * `process.stdout` rather than `log` so no prefix or color corrupts it.
 */
function writeSummary(summary: SweepSummary): void {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}
