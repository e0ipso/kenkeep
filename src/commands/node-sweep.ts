import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, posix } from 'node:path';
import { incomingReferrers, placeLeaf, type PlacementReason } from '../lib/leaf-placement.js';
import { log as humanLog, stderrLog, writeJsonDocument, type Logger } from '../lib/log.js';
import { readAllNodes, resolveLeafDir, type NodeFile } from '../lib/nodes.js';
import { findRepoRoot, repoPaths, type RepoPaths } from '../lib/paths.js';
import { assertContained } from '../lib/path-safety.js';
import { relocateBytes } from '../lib/rebalance-move.js';
import { readRedirectsLedger } from '../lib/redirects.js';
import { refreshRenderedLinks } from '../lib/rendered-links.js';
import { preflightIndexRebuild, runIndexRebuild } from './index-rebuild.js';

/** Why a leaf matched nothing: the only condition `placeLeaf` reports unplaceable. */
const UNPLACEABLE_REASON = 'no folder-resolving edges and no tag overlap with any folder';

const REFERENCED_REASON = `${UNPLACEABLE_REASON}; kept because other nodes reference it`;

const UNRESTORABLE_REASON =
  `${UNPLACEABLE_REASON}; kept because git cannot restore it (untracked, ` +
  'flagged assume-unchanged or skip-worktree, or tracked with unstaged edits)';

/** One leaf filed into the folder its own edges and tags named. */
interface SweepRelocation {
  id: string;
  /** POSIX path relative to `nodes/`, before the move. */
  from: string;
  /** POSIX path relative to `nodes/`, after the move. */
  to: string;
  reason: PlacementReason;
}

/**
 * One leaf removed because it matched no folder, nothing references it, and
 * git holds its exact bytes. `restore` is the command, run from the repository
 * root, that brings it back.
 */
interface SweepDeletion {
  id: string;
  /** POSIX path relative to `nodes/`, before the deletion. */
  path: string;
  reason: string;
  restore: string;
}

/** One unplaceable leaf left at the root: other nodes reference it, or git cannot restore it. */
interface SweepKept {
  id: string;
  /** POSIX path relative to `nodes/`. */
  path: string;
  reason: string;
  /** Ids of the nodes whose `kk_relates_to`/`kk_depends_on` name this leaf. */
  referenced_by: string[];
}

/**
 * The command's stdout contract, one JSON document. Every root leaf the sweep
 * looked at lands in exactly one list. `skipped` is present only when the tree
 * has no folder to file into; a normal run omits it. `failed` marks a sweep
 * whose writes landed but whose index rebuild did not, so the caller knows the
 * tree is written but its indexes are stale.
 */
export interface SweepSummary {
  relocated: SweepRelocation[];
  deleted: SweepDeletion[];
  kept: SweepKept[];
  skipped?: 'no-folders';
  failed?: true;
}

/**
 * Deterministic, LLM-free sweep of the `nodes/` root.
 *
 * A leaf lands at the root when curation declines to pick a folder for it.
 * Session start injects the entry catalog, which lists every root leaf, and no
 * folder `index.md` lists them, so a root leaf costs context in every session
 * on every harness and is reachable only from that catalog. This command
 * empties the root as far as it safely can:
 *
 * - A leaf its own edges and tags place (`placeLeaf`) is relocated there as a
 *   byte-stable rename (id unchanged, so no redirect is recorded).
 * - An unplaceable leaf whose exact bytes `git restore` would write back
 *   (tracked with no index flag, working copy equal to the index copy) and
 *   that no other node references is deleted, and the summary names its
 *   `git restore`.
 * - Every other unplaceable leaf stays at the root and is reported as kept:
 *   removing a referenced leaf would leave dangling edges, and git could not
 *   bring back an untracked or edited one.
 *
 * The deterministic index rebuild then regenerates the folder indexes, the
 * entry catalog, GRAPH.md and `nodes_hash`.
 *
 * It writes files only. It never stages, commits, or restores. The human
 * accepts the diff with `git commit` and rejects it with a path-scoped
 * `git restore`, deletions included.
 *
 * A tree with no folders short-circuits before any write. A fresh or
 * bootstrap-era tree has nowhere to file anything, and every leaf in it would
 * otherwise look unplaceable.
 *
 * `init --upgrade` runs the same sweep through `sweepRootLeaves` below, so an
 * upgrade files or removes loose leaves without the user invoking this command.
 * This command remains the way to sweep on demand between upgrades.
 */
export async function runNodeSweep(): Promise<number> {
  // Machine output: every diagnostic, including the nested index rebuild's,
  // goes to stderr so stdout carries only the JSON summary.
  const log = stderrLog;
  const root = findRepoRoot();
  const paths = repoPaths(root);

  if (!existsSync(paths.installedVersionFile)) {
    log.error(
      'kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.'
    );
    return 1;
  }

  let summary: SweepSummary;
  try {
    summary = await sweepRootLeaves(paths, log);
  } catch (err) {
    log.error(`node sweep: ${(err as Error).message}`);
    return 1;
  }

  if (summary.failed === true) {
    log.error('node sweep: index rebuild failed after the sweep; review with `git diff`.');
    return 1;
  }

  writeJsonDocument(summary);
  return 0;
}

/**
 * The sweep itself, decoupled from the command's stdout contract so
 * `init --upgrade` can run the same rules and report them as prose instead of
 * JSON. Takes the resolved repo paths rather than discovering them, because
 * both callers have already resolved them.
 *
 * Throws when the tree cannot be read. Every other failure is reported through
 * the returned summary so a caller can decide whether it is fatal. `log`
 * receives the sweep's and the nested index rebuild's status lines; the
 * machine-output command passes `stderrLog`.
 */
export async function sweepRootLeaves(
  paths: RepoPaths,
  log: Logger = humanLog
): Promise<SweepSummary> {
  const { nodesDir } = paths;
  const tree: NodeFile[] = readAllNodes(nodesDir);
  // Edges naming a retired id are valid edges (lint: redirected-edge): they
  // place a leaf by, and protect, the live successor the ledger names.
  const ledger = readRedirectsLedger(nodesDir);

  // `readAllNodes` returns leaves sorted by relPath, so the root leaves, and
  // the summary built from them, come out in a stable order.
  const rootLeaves = tree.filter(leaf => leaf.relDir === '');

  // Decide every placement against this one snapshot, then apply. A sweep only
  // moves leaves out of the root, so relocating one root leaf changes no other
  // leaf's folder. Deciding first also short-circuits the no-folders case
  // before any write.
  const destination = new Map<string, { folder: string; reason: PlacementReason }>();
  const unplaced: NodeFile[] = [];
  for (const leaf of rootLeaves) {
    const placement = placeLeaf(leaf.frontmatter, tree, leaf.frontmatter.kk_id, ledger);
    if (placement.kind === 'no-folders') {
      return { relocated: [], deleted: [], kept: [], skipped: 'no-folders' };
    }
    if (placement.kind === 'placed') {
      destination.set(leaf.frontmatter.kk_id, placement);
    } else {
      unplaced.push(leaf);
    }
  }

  const referrers = new Map(
    unplaced.map(leaf => [
      leaf.frontmatter.kk_id,
      incomingReferrers(leaf.frontmatter.kk_id, tree, ledger),
    ])
  );
  const restorable = restorablePaths(
    nodesDir,
    unplaced.filter(leaf => referrers.get(leaf.frontmatter.kk_id)?.length === 0)
  );

  // Resolve every write before the first one: each relocation's source and
  // destination, each deletion's path. The containment boundary refuses a
  // symlinked leaf here, so a refusal can never follow an applied move.
  const relocations: Array<SweepRelocation & { src: string; dest: string }> = [];
  const deletions: Array<SweepDeletion & { src: string }> = [];
  const summary: SweepSummary = { relocated: [], deleted: [], kept: [] };
  for (const leaf of rootLeaves) {
    const id = leaf.frontmatter.kk_id;
    const placed = destination.get(id);
    if (placed !== undefined) {
      const destDir = resolveLeafDir(nodesDir, placed.folder);
      relocations.push({
        id,
        from: leaf.relPath,
        to: posix.join(placed.folder, leaf.filename),
        reason: placed.reason,
        src: assertContained(nodesDir, leaf.path),
        dest: assertContained(nodesDir, join(destDir, leaf.filename)),
      });
      continue;
    }
    const referencedBy = (referrers.get(id) ?? []).map(node => node.frontmatter.kk_id);
    const gitPath = referencedBy.length === 0 ? restorable.get(leaf.filename) : undefined;
    if (gitPath !== undefined) {
      deletions.push({
        id,
        path: leaf.relPath,
        reason: UNPLACEABLE_REASON,
        restore: `git restore -- ${gitPath}`,
        src: assertContained(nodesDir, leaf.path),
      });
      continue;
    }
    summary.kept.push({
      id,
      path: leaf.relPath,
      reason: referencedBy.length > 0 ? REFERENCED_REASON : UNRESTORABLE_REASON,
      referenced_by: referencedBy,
    });
  }
  // The rebuild that follows any write refuses a malformed config or AGENTS.md
  // block; refuse here instead, before a leaf moves.
  if (relocations.length + deletions.length > 0) preflightIndexRebuild(paths.root);

  try {
    for (const { src, dest, ...relocation } of relocations) {
      relocateBytes(src, dest);
      summary.relocated.push(relocation);
    }
    for (const { src, ...deletion } of deletions) {
      rmSync(src);
      summary.deleted.push(deletion);
    }
    // Rendered links are leaf-relative: a relocated leaf and every leaf linking
    // to it render new hrefs. Refresh exactly those before the rebuild hashes
    // the tree. Deleted leaves have no referrers by construction.
    if (summary.relocated.length > 0) {
      refreshRenderedLinks(nodesDir, new Set(summary.relocated.map(r => r.id)));
    }
  } catch (err) {
    log.error('The sweep stopped partway; review the working tree with `git diff`.');
    throw err;
  }

  if (summary.relocated.length + summary.deleted.length > 0) {
    const rebuildCode = await runIndexRebuild({ logger: log });
    if (rebuildCode !== 0) {
      summary.failed = true;
    }
  }

  return summary;
}

/**
 * The root leaves whose exact bytes git can bring back with `git restore`,
 * keyed by filename, valued by their path from the repository root.
 * `git restore` writes the index copy through the checkout filters, so a leaf
 * qualifies only when git tracks it with no index flag and those bytes equal
 * the working copy. Git's own change detection is not trusted:
 * `assume-unchanged` and `skip-worktree` hide edits from `git diff`, and
 * `git restore` skips a `skip-worktree` path. Anything else, including every
 * leaf outside a git work tree or when git itself fails, is absent: the caller
 * must not delete it. Read-only: nothing is staged and no index flag changes.
 */
function restorablePaths(nodesDir: string, leaves: NodeFile[]): Map<string, string> {
  const out = new Map<string, string>();
  if (leaves.length === 0) return out;
  const git = (args: string[]): Buffer | null => {
    const result = spawnSync('git', ['--literal-pathspecs', ...args], {
      cwd: nodesDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return result.error === undefined && result.status === 0 ? result.stdout : null;
  };
  const prefix = git(['rev-parse', '--show-prefix'])?.toString('utf8').replace(/\n$/, '');
  // `-v` tags each entry: `H` is a plain tracked file; lowercase `h` is
  // assume-unchanged, `S`/`s` skip-worktree, and other letters are unmerged
  // or otherwise not a clean index entry.
  const tagged = git(['ls-files', '-v', '-z', '--', ...leaves.map(leaf => leaf.filename)]);
  if (prefix === undefined || tagged === null) return out;

  const plain = new Set(
    tagged
      .toString('utf8')
      .split('\0')
      .filter(entry => entry.startsWith('H '))
      .map(entry => entry.slice(2))
  );
  for (const leaf of leaves) {
    if (!plain.has(leaf.filename)) continue;
    const gitPath = `${prefix}${leaf.filename}`;
    const restored = git(['cat-file', '--filters', `:${gitPath}`]);
    if (restored !== null && restored.equals(readFileSync(leaf.path))) {
      out.set(leaf.filename, gitPath);
    }
  }
  return out;
}
