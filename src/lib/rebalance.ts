import { generateIndex, type FolderMetrics } from './index-gen.js';
import { readAllNodes, type NodeFile } from './nodes.js';

/**
 * Deterministic, LLM-free rebalance thresholds. All decisions in this module
 * are a pure function of Plan 1's per-folder metrics plus these named
 * constants. The hysteresis design is the safety mechanism that replaces the
 * missing human checkpoint inside an act-and-fold curate run: split fires only
 * well past a high-water mark and merge only well below a low-water mark, with
 * a deliberate gap between them so a single borderline leaf cannot flip a
 * folder back and forth across consecutive runs.
 */

/**
 * Split high-water mark: a folder splits only when its direct-leaf occupancy is
 * strictly greater than this. Set high enough that an ordinary folder gaining a
 * leaf or two never trips it.
 */
export const FOLDER_OCCUPANCY_MAX = 12;

/**
 * Merge low-water mark: a non-root branch merges only when its direct-leaf
 * occupancy is strictly less than this. A folder with this many leaves or more
 * is considered viable and is left alone.
 */
export const BRANCH_OCCUPANCY_MIN = 2;

/**
 * The hysteresis gap is the span between the merge low-water and the split
 * high-water mark. Inside this band the trigger reports no action, so a folder
 * oscillating by one leaf around a boundary settles instead of thrashing. The
 * module asserts the gap is real at load time.
 */
export const HYSTERESIS_GAP = FOLDER_OCCUPANCY_MAX - BRANCH_OCCUPANCY_MIN;

/**
 * Split-leaf size gate: a single leaf is a split candidate only when its
 * estimated token size is strictly greater than this. Big enough that ordinary
 * leaves never qualify; only a leaf that has accreted several concepts does.
 */
export const LEAF_SIZE_SPLIT_THRESHOLD = 1500;

/**
 * Split-leaf concept gate: a leaf splits only when it carries at least this
 * many distinct tags, the deterministic stand-in for "covers two or more
 * distinct concepts". The trigger never calls an LLM to judge this; the tag
 * count is the LLM-free concept signal.
 */
export const LEAF_CONCEPT_MIN = 3;

/**
 * Create-branch signal: a leaf sitting at the `nodes/` root (no home folder)
 * with no graph edges to any other node is a homeless, novel top-level topic.
 *
 * Plan 1 exposes no dedicated "novel topic" metric. The trigger keys
 * deterministically on the root-fallback signal the curate skill already
 * produces: an `add` whose relate-ranking cleared no existing folder lands the
 * leaf at the `nodes/` root (documented in kk-curate "Relate and place" /
 * "Root fallback"). A root leaf with zero `relates_to` and `derived_from`
 * edges is therefore a top-level topic with no existing home, which is exactly
 * what `create-branch` addresses.
 */
export const ROOT_HOMELESS_EDGE_MAX = 0;

/**
 * Hard invariant: the merge low-water must sit strictly below the split
 * high-water with a real gap, otherwise a single folder could simultaneously
 * want to split and want to merge and the tree would never settle.
 */
if (BRANCH_OCCUPANCY_MIN >= FOLDER_OCCUPANCY_MAX) {
  throw new Error(
    'rebalance thresholds invalid: BRANCH_OCCUPANCY_MIN must be strictly below FOLDER_OCCUPANCY_MAX'
  );
}

/** The four structural operation classes a tripped trigger can signal. */
export type RebalanceOperation = 'split-folder' | 'split-leaf' | 'merge' | 'create-branch';

/**
 * One candidate structural action. `branch` is the POSIX-style folder relative
 * to `nodes/` for folder-level operations (split-folder, merge) or, for a
 * leaf-level operation (split-leaf, create-branch), the leaf's current relative
 * path. The LLM clustering step (quarantined, in the curate skill) reasons only
 * over the branches this list names; the trigger itself is LLM-free.
 */
export interface RebalanceCandidate {
  branch: string;
  operation: RebalanceOperation;
}

/** The trigger's structured, machine-readable decision. */
export interface RebalanceDecision {
  actions: RebalanceCandidate[];
}

/**
 * Per-folder occupancy/diversity/leaf-size metric for one folder, keyed by its
 * POSIX-style path relative to `nodes/` (empty string is the root).
 */
export interface FolderMetricEntry {
  relDir: string;
  metrics: FolderMetrics;
}

/** Estimated token size of one leaf, mirroring index-gen's estimator. */
const CHARS_PER_TOKEN = 4;
function estimateLeafTokens(node: NodeFile): number {
  const chars =
    node.frontmatter.title.length + node.frontmatter.summary.length + node.body.length;
  return Math.max(0, Math.ceil(chars / CHARS_PER_TOKEN));
}

/**
 * Pure decision function: given the per-folder metrics Plan 1 computes and the
 * leaf set, return the deterministic rebalance decision. No clock, no
 * randomness, no LLM; identical input yields byte-identical output (the
 * `actions` array is sorted for stability).
 *
 * Rules (each gated past its hysteresis margin):
 *   - split-folder: a folder whose occupancy is strictly greater than
 *     FOLDER_OCCUPANCY_MAX.
 *   - merge: a non-root branch whose occupancy is strictly less than
 *     BRANCH_OCCUPANCY_MIN (an empty folder carries no metric entry and so
 *     never trips this; only a sparse-but-occupied branch does).
 *   - split-leaf: a single leaf whose estimated size exceeds
 *     LEAF_SIZE_SPLIT_THRESHOLD AND whose distinct-tag count is at least
 *     LEAF_CONCEPT_MIN.
 *   - create-branch: a leaf at the `nodes/` root with no graph edges (the
 *     curate root-fallback signal for a homeless novel top-level topic).
 */
export function decideRebalance(
  folders: FolderMetricEntry[],
  leaves: NodeFile[]
): RebalanceDecision {
  const actions: RebalanceCandidate[] = [];

  for (const f of folders) {
    if (f.metrics.occupancy > FOLDER_OCCUPANCY_MAX) {
      actions.push({ branch: f.relDir, operation: 'split-folder' });
    }
    // The root (empty relDir) is never a merge candidate: it is the deliberate
    // fallback home, not a sparse branch to collapse.
    if (f.relDir !== '' && f.metrics.occupancy < BRANCH_OCCUPANCY_MIN) {
      actions.push({ branch: f.relDir, operation: 'merge' });
    }
  }

  for (const leaf of leaves) {
    const size = estimateLeafTokens(leaf);
    const distinctConcepts = new Set(leaf.frontmatter.tags).size;
    if (size > LEAF_SIZE_SPLIT_THRESHOLD && distinctConcepts >= LEAF_CONCEPT_MIN) {
      actions.push({ branch: leaf.relPath, operation: 'split-leaf' });
    }
    const edgeCount = leaf.frontmatter.relates_to.length + leaf.frontmatter.derived_from.length;
    if (leaf.relDir === '' && edgeCount <= ROOT_HOMELESS_EDGE_MAX) {
      actions.push({ branch: leaf.relPath, operation: 'create-branch' });
    }
  }

  // Deterministic stable ordering: by branch path, then operation.
  actions.sort((a, b) => {
    const c = a.branch.localeCompare(b.branch);
    if (c !== 0) return c;
    return a.operation.localeCompare(b.operation);
  });

  return { actions };
}

/**
 * Reads the live tree under `nodesDir`, computes Plan 1's per-folder metrics via
 * `generateIndex` (the same source of truth, not a fork of the metric math),
 * and returns the deterministic rebalance decision. This is the consumable
 * entrypoint the trigger command and the curate skill call.
 */
export function evaluateRebalance(nodesDir: string): RebalanceDecision {
  const index = generateIndex(nodesDir);
  const folders: FolderMetricEntry[] = [...index.folders.values()].map(f => ({
    relDir: f.relDir,
    metrics: f.metrics,
  }));
  const leaves = readAllNodes(nodesDir);
  return decideRebalance(folders, leaves);
}
