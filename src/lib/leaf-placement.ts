import type { NodeFile } from './nodes.js';

/**
 * Deterministic home-folder placement for a loose leaf.
 *
 * A leaf lands at the `nodes/` root when curation declines to pick a folder.
 * Its own frontmatter usually names the home anyway: its `kk_relates_to` and
 * `kk_depends_on` targets already live in folders, and its tags already appear
 * on those folders' leaves. This module turns that evidence into a destination,
 * or reports that the evidence ran out.
 *
 * It is pure: no clock, no randomness, no LLM, no filesystem access. The caller
 * reads the tree (`readAllNodes`, or the leaf set `generateIndex` already
 * carries) and passes it in, so identical input always yields identical output.
 *
 * Resolution runs in order and stops at the first single winner:
 *
 *   1. Tally every edge target by the folder it currently occupies. Targets
 *      that dangle, that sit at the root, or that are the leaf itself
 *      contribute nothing. `kk_relates_to` and `kk_depends_on` carry equal
 *      weight; that is a starting point to revisit if evidence appears, not a
 *      measured conclusion.
 *   2. On a tie, score each tied folder by how many of the leaf's tags appear
 *      across that folder's direct leaves, summing occurrences rather than
 *      counting distinct tags. Highest score wins.
 *   3. On a further tie, take the alphabetically first folder path. Arbitrary
 *      by intent, because the evidence has run out, and never random, because
 *      the result has to be reproducible.
 *   4. With no edge candidate at all, score every folder in the tree by the
 *      same tag overlap.
 *   5. Zero overlap against every folder means the leaf is unplaceable.
 *
 * A tree with no folders reports `no-folders` rather than `unplaceable`. A
 * fresh or bootstrap-era tree has nowhere to file anything, and that state must
 * never reach the sweep's delete rule.
 *
 * Ranking folder summaries is deliberately absent. Reading summaries and
 * picking a folder from them is the curator's judgment call, and it was already
 * made and declined for every leaf that reaches this function. Placement reads
 * only the two signals the curator left behind.
 */

/** Which rule produced a destination, for callers that report placements. */
export type PlacementReason = 'edges' | 'tags' | 'alphabetical';

/**
 * Where a loose leaf belongs. `unplaceable` means the tree has folders and the
 * leaf matched none of them; `no-folders` means the tree has no folder to file
 * into at all. The two are separate because only the first is evidence about
 * the leaf.
 */
export type PlacementResult =
  | { kind: 'placed'; folder: string; reason: PlacementReason }
  | { kind: 'unplaceable' }
  | { kind: 'no-folders' };

/**
 * The frontmatter fields placement reads. A stored `NodeFrontmatter` satisfies
 * it, and so does a curator's `proposed_node` before anything is written.
 */
export interface PlacementInput {
  tags: string[];
  kk_relates_to: string[];
  kk_depends_on?: string[] | undefined;
}

/** POSIX folder paths order by `localeCompare`, the final tie-break. */
function comparePaths(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Leaves keyed by their POSIX folder relative to `nodes/`. */
function groupByFolder(tree: NodeFile[]): Map<string, NodeFile[]> {
  const byFolder = new Map<string, NodeFile[]>();
  for (const node of tree) {
    const bucket = byFolder.get(node.relDir);
    if (bucket === undefined) byFolder.set(node.relDir, [node]);
    else bucket.push(node);
  }
  return byFolder;
}

/**
 * Folders holding the highest edge tally, alphabetically ordered. Empty when no
 * target resolves to a folder.
 */
function topByEdgeCount(
  leaf: PlacementInput,
  tree: NodeFile[],
  selfId: string | undefined
): string[] {
  const folderById = new Map(tree.map(node => [node.frontmatter.kk_id, node.relDir]));
  const counts = new Map<string, number>();
  for (const id of [...leaf.kk_relates_to, ...(leaf.kk_depends_on ?? [])]) {
    if (id === selfId) continue;
    const folder = folderById.get(id);
    if (folder === undefined || folder === '') continue;
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) if (count > best) best = count;
  return [...counts.entries()]
    .filter(([, count]) => count === best)
    .map(([folder]) => folder)
    .sort(comparePaths);
}

/** Occurrences of the leaf's tags across one folder's direct leaves. */
function tagOverlap(leaves: NodeFile[], tags: Set<string>, selfId: string | undefined): number {
  let score = 0;
  for (const node of leaves) {
    if (node.frontmatter.kk_id === selfId) continue;
    for (const tag of node.frontmatter.tags) {
      if (tags.has(tag)) score += 1;
    }
  }
  return score;
}

/** Candidates holding the highest tag-overlap score, alphabetically ordered. */
function topByTagOverlap(
  candidates: string[],
  tags: Set<string>,
  byFolder: Map<string, NodeFile[]>,
  selfId: string | undefined
): { score: number; folders: string[] } {
  let score = -1;
  let folders: string[] = [];
  for (const folder of [...candidates].sort(comparePaths)) {
    const current = tagOverlap(byFolder.get(folder) ?? [], tags, selfId);
    if (current > score) {
      score = current;
      folders = [folder];
    } else if (current === score) {
      folders.push(folder);
    }
  }
  return { score, folders };
}

/**
 * One top folder is a tag-overlap win; several means the scores tied and the
 * alphabetical order already applied decides.
 */
function placeByOverlap(top: string[]): PlacementResult {
  return { kind: 'placed', folder: top[0]!, reason: top.length === 1 ? 'tags' : 'alphabetical' };
}

/**
 * Resolves a leaf's home folder from its own edges and tags against the given
 * tree. `selfId` is the leaf's id when it is already part of `tree`, so it
 * neither votes for its own folder nor scores against itself.
 */
export function placeLeaf(
  leaf: PlacementInput,
  tree: NodeFile[],
  selfId?: string
): PlacementResult {
  const byFolder = groupByFolder(tree);
  // Root leaves belong to no folder: they are neither a destination nor tag
  // evidence for one.
  byFolder.delete('');
  const folders = [...byFolder.keys()];
  if (folders.length === 0) return { kind: 'no-folders' };

  const tags = new Set(leaf.tags);
  const edgeCandidates = topByEdgeCount(leaf, tree, selfId);
  if (edgeCandidates.length === 1) {
    return { kind: 'placed', folder: edgeCandidates[0]!, reason: 'edges' };
  }
  if (edgeCandidates.length > 1) {
    return placeByOverlap(topByTagOverlap(edgeCandidates, tags, byFolder, selfId).folders);
  }

  const wholeTree = topByTagOverlap(folders, tags, byFolder, selfId);
  if (wholeTree.score <= 0) return { kind: 'unplaceable' };
  return placeByOverlap(wholeTree.folders);
}
